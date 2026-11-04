'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Building2,
  Theater,
  CalendarDays,
  Clock,
  Phone,
  MapPin,
  UserCheck,
  Ban,
  History,
  Loader2,
} from 'lucide-react';
import { EventItem, PartyBookingRecord, PartyItem } from '@/types';
import { computeParties, syncRemoteParties } from '@/lib/parties';
import { useAdminPopup } from '@/context/AdminPopupContext';
import { useAdminSession } from '@/context/AdminSessionContext';
import {
  cancelPartyBooking,
  committeeIdFor,
  createPartyBooking,
  fetchPartyBookings,
  subscribeToPartyBookings,
  toIsoDate,
} from '@/lib/partyBookings';

interface PartyBookingViewProps {
  events: EventItem[];
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface CommitteeOption {
  name: string;
  location: string;
}

export default function PartyBookingView({ events }: PartyBookingViewProps) {
  const { session, isSuperAdmin } = useAdminSession();
  const { confirm: adminConfirm, alert: adminAlert } = useAdminPopup();

  // ── Parties ────────────────────────────────────────────────────
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    syncRemoteParties().then(() => setRefreshKey((k) => k + 1));
  }, []);

  const parties = useMemo<PartyItem[]>(() => {
    refreshKey;
    return computeParties(events).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, refreshKey]);

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const selectedParty = useMemo(
    () => parties.find((p) => p.id === selectedPartyId) || null,
    [parties, selectedPartyId]
  );

  // ── Committee directory (from live events, plus free text allowed) ─
  // A committee always books as itself; the server enforces the same rule.
  useEffect(() => {
    const own = session?.committee?.committeeName;
    if (own) setForm((f) => (f.committeeName === own ? f : { ...f, committeeName: own }));
  }, [session?.committee?.committeeName]);

  const committeeOptions = useMemo<CommitteeOption[]>(() => {
    const map = new Map<string, CommitteeOption>();
    events.forEach((e) => {
      const name = String(e.committeeName || '').trim();
      if (!name) return;
      const key = name.toUpperCase();
      const loc = String(e.committeeLocation || '').trim();
      const existing = map.get(key);
      if (!existing) map.set(key, { name, location: loc });
      else if (!existing.location && loc) existing.location = loc;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  // ── Global stats (all confirmed bookings) ──────────────────────
  const [allConfirmed, setAllConfirmed] = useState<PartyBookingRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadAllConfirmed = useCallback(async () => {
    try {
      const rows = await fetchPartyBookings({ status: 'Confirmed' });
      setAllConfirmed(rows);
      setApiError(null);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadAllConfirmed();
  }, [loadAllConfirmed]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const globalStats = useMemo(() => {
    const committees = new Set<string>();
    allConfirmed.forEach((b) => committees.add(String(b.committee_name || '').trim().toUpperCase()));
    committees.delete('');
    const partyIds = new Set<string>();
    allConfirmed.forEach((b) => partyIds.add(b.party_id));
    return {
      totalCommittees: committees.size,
      totalParties: parties.length,
      totalBookings: allConfirmed.length,
      upcomingBookings: allConfirmed.filter((b) => b.booking_date > todayIso).length,
    };
  }, [allConfirmed, parties.length, todayIso]);

  // ── Party-wide bookings for the selected party (calendar + counts) ─
  const [partyBookings, setPartyBookings] = useState<PartyBookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [selectedBooking, setSelectedBooking] = useState<PartyBookingRecord | null>(null);

  const loadPartyBookings = useCallback(async (partyId: string) => {
    setLoadingBookings(true);
    try {
      const now = new Date();
      const from = toIsoDate(new Date(now.getFullYear() - 1, 0, 1));
      const to = toIsoDate(new Date(now.getFullYear() + 1, 11, 31));
      const rows = await fetchPartyBookings({ partyId, status: 'Confirmed', from, to });
      setPartyBookings(rows);
      setBookedDates(new Set(rows.map((r) => r.booking_date)));
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPartyId) {
      loadPartyBookings(selectedPartyId);
      setSelectedBooking(null);
    } else {
      setPartyBookings([]);
      setBookedDates(new Set());
      setSelectedBooking(null);
    }
  }, [selectedPartyId, loadPartyBookings]);

  // ── Booking history (cancelled, kept forever) ──────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PartyBookingRecord[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleHistory = useCallback(async () => {
    if (!selectedPartyId) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history === null) {
      setLoadingHistory(true);
      try {
        const rows = await fetchPartyBookings({ partyId: selectedPartyId, status: 'Cancelled' });
        setHistory(rows);
      } catch (err) {
        setApiError((err as Error).message);
      } finally {
        setLoadingHistory(false);
      }
    }
  }, [selectedPartyId, historyOpen, history]);

  useEffect(() => {
    setHistory(null);
    setHistoryOpen(false);
  }, [selectedPartyId]);

  // ── Realtime ───────────────────────────────────────────────────
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeToPartyBookings((payload) => {
      const changedParty = String(payload.new?.party_id ?? payload.old?.party_id ?? '');
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        loadAllConfirmed();
        if (changedParty && changedParty === selectedPartyId) {
          loadPartyBookings(selectedPartyId);
        }
      }, 300);
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [selectedPartyId, loadAllConfirmed, loadPartyBookings]);

  // ── Calendar month state (opens on the current month; arrows navigate) ──
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const firstWeekday = new Date(viewYear, viewMonth, 0).getDay() + 1; // days before the 1st
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday - 1 + daysInMonth) / 7) * 7;

  const monthKey = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, PartyBookingRecord[]>();
    partyBookings.forEach((b) => {
      const list = map.get(b.booking_date) || [];
      list.push(b);
      map.set(b.booking_date, list);
    });
    return map;
  }, [partyBookings]);

  // ── Selection / modal state ────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleDayClick = (iso: string, booked: boolean) => {
    setSelectedDate(iso);
    if (booked) {
      const list = bookingsByDate.get(iso) || [];
      setSelectedBooking(list[0] || null);
    } else {
      setSelectedBooking(null);
      setModalOpen(true);
    }
  };

  // ── Create booking form ────────────────────────────────────────
  const [form, setForm] = useState({
    committeeName: '',
    committeeAddress: '',
    eventName: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [committeeSearch, setCommitteeSearch] = useState('');
  const [committeeDropdownOpen, setCommitteeDropdownOpen] = useState(false);

  const resetForm = () => {
    setForm({ committeeName: '', committeeAddress: '', eventName: '' });
    setCommitteeSearch('');
    setFormError(null);
    setCommitteeDropdownOpen(false);
  };

  const filteredCommittees = useMemo(() => {
    const q = committeeSearch.trim().toUpperCase();
    if (!q) return committeeOptions.slice(0, 30);
    return committeeOptions.filter((c) => c.name.toUpperCase().includes(q)).slice(0, 30);
  }, [committeeSearch, committeeOptions]);

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedParty) return setFormError('Select a party first.');
    if (!selectedDate) return setFormError('Booking date is required.');
    if (!form.committeeName.trim()) return setFormError('Committee name is required.');
    if (!form.eventName.trim()) return setFormError('Programme / Event name is required.');
    const { committeeName, eventName } = form;
    const eventAddress = (selectedParty.location || '').trim() || selectedParty.name;
    const bookingDate = selectedDate;
    setFormError(null);
    setSaving(true);
    try {
      await createPartyBooking({
        partyId: selectedParty.id,
        partyName: selectedParty.name,
        committeeId: committeeIdFor(committeeName),
        committeeName: committeeName.trim(),
        committeeAddress: form.committeeAddress.trim() || undefined,
        eventName: eventName.trim(),
        eventAddress,
        bookingDate,
      });
      setModalOpen(false);
      resetForm();
      setSelectedBooking(null);
      await Promise.all([loadPartyBookings(selectedParty.id), loadAllConfirmed()]);
      await adminAlert({
        title: 'Booking Confirmed',
        type: 'created',
        message: `${selectedParty.name} is booked for ${eventName.trim()} on ${formatDateLabel(bookingDate)}.`,
        itemTitle: committeeName.trim(),
        itemSubtitle: formatDateLabel(bookingDate),
        celebrate: true,
      });
    } catch (err) {
      const message = (err as Error).message;
      setModalOpen(false);
      await adminAlert({
        title: message.includes('already booked') ? 'Date Not Available' : 'Booking Failed',
        type: 'error',
        message,
      });
      if (selectedParty) {
        await Promise.all([
          loadPartyBookings(selectedParty.id).catch(() => {}),
          loadAllConfirmed().catch(() => {}),
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (booking: PartyBookingRecord) => {
    const ok = await adminConfirm({
      title: 'Cancel this booking?',
      type: 'warning',
      message: (
        <span>
          <b>{booking.event_name}</b> — {booking.party_name} on <b>{formatDateLabel(booking.booking_date)}</b>.
          The date will be released for new bookings. The record stays in booking history.
        </span>
      ),
      itemTitle: booking.committee_name,
      itemSubtitle: booking.event_address,
      confirmText: 'Cancel Booking',
      cancelText: 'Keep It',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await cancelPartyBooking(booking.id);
      setSelectedBooking(null);
      setHistory(null);
      await Promise.all([loadPartyBookings(booking.party_id), loadAllConfirmed()]);
      await adminAlert({
        title: 'Booking Cancelled',
        type: 'info',
        message: `${booking.party_name} is available again on ${formatDateLabel(booking.booking_date)}. History record preserved.`,
      });
    } catch (err) {
      await adminAlert({ title: 'Cancellation Failed', type: 'error', message: (err as Error).message });
    } finally {
      setCancelling(false);
    }
  };

  // ── Party-specific stats ───────────────────────────────────────
  const partyStats = useMemo(() => {
    if (!selectedParty) return null;
    const committees = new Set<string>(
      partyBookings.map((b) => String(b.committee_name || '').trim().toUpperCase()).filter(Boolean)
    );
    return {
      total: partyBookings.length,
      upcoming: partyBookings.filter((b) => b.booking_date > todayIso).length,
      committees: committees.size,
    };
  }, [selectedParty, partyBookings, todayIso]);

  // ═══════════════════════════ RENDER ═══════════════════════════
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20';

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#ec4899] to-[#10b981] text-white shadow-md">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">Party Booking Management</h2>
            <p className="text-xs font-medium text-slate-500">
              Committee ↔ Opera Party bookings, calendars and history — synced live with the Customer Project.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </div>
      </div>

      {apiError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {apiError}
        </div>
      )}

      {/* 2. Party Selection Dropdown */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
          Select Party
        </label>
        <PartyCombobox parties={parties} selected={selectedParty} onSelect={(p) => setSelectedPartyId(p ? p.id : null)} />
      </div>

      {/* 3. Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label={selectedParty ? "This Party's Committees" : 'Total Committees'}
          value={loadingStats ? '—' : selectedParty ? partyStats?.committees ?? 0 : globalStats.totalCommittees}
          tone="pink"
        />
        <StatCard
          icon={<Theater className="h-5 w-5" />}
          label="Total Parties"
          value={loadingStats ? '—' : globalStats.totalParties}
          tone="green"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label={selectedParty ? `${selectedParty.name.split(' ')[0]}'s Bookings` : 'Total Bookings'}
          value={loadingStats ? '—' : selectedParty ? partyStats?.total ?? 0 : globalStats.totalBookings}
          tone="pink"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Upcoming Bookings"
          value={loadingStats ? '—' : selectedParty ? partyStats?.upcoming ?? 0 : globalStats.upcomingBookings}
          tone="green"
        />
      </div>

      {/* 4. Selected Party Details */}
      {selectedParty && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Party Profile</h3>
            <button
              onClick={() => setSelectedPartyId(null)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailTile label="Party Name" value={selectedParty.name} />
            <DetailTile label="Party ID" value={selectedParty.id} mono />
            <DetailTile
              label="Contact Number"
              value={[selectedParty.phone, selectedParty.phone2].filter(Boolean).join(' / ') || '—'}
              icon={<Phone className="h-3.5 w-3.5" />}
            />
            <DetailTile label="Address / Location" value={selectedParty.location || '—'} icon={<MapPin className="h-3.5 w-3.5" />} />
            <DetailTile
              label="Party Status"
              value={
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase ${
                    selectedParty.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {selectedParty.status || 'active'}
                </span>
              }
              icon={<UserCheck className="h-3.5 w-3.5" />}
            />
            <DetailTile label="Total Bookings" value={String(partyStats?.total ?? 0)} />
            <DetailTile label="Upcoming Bookings" value={String(partyStats?.upcoming ?? 0)} />
          </div>
        </div>
      )}

      {/* 5. Party Booking Calendar */}
      {selectedParty ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Booking Calendar — {selectedParty.name}
            </h3>
            <button
              onClick={toggleHistory}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" />
              {historyOpen ? 'Hide History' : 'Booking History'}
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#ec4899] hover:text-[#ec4899]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-sm font-black uppercase tracking-wide text-slate-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#ec4899] hover:text-[#ec4899]"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1 text-center text-[10px] font-black uppercase text-slate-400">
                {w}
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-7 gap-1.5">
            {loadingBookings && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-[#ec4899]" />
              </div>
            )}
            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - (firstWeekday - 1) + 1;
              const inMonth = day >= 1 && day <= daysInMonth;
              if (!inMonth) {
                return (
                  <div key={i} className="flex aspect-square items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-300 sm:aspect-auto sm:min-h-14">
                    {day < 1
                      ? new Date(viewYear, viewMonth - 1, new Date(viewYear, viewMonth, 0).getDate() + day).getDate()
                      : day - daysInMonth}
                  </div>
                );
              }
              const iso = monthKey(day);
              const booked = bookedDates.has(iso);
              const isPast = iso < todayIso;
              const isToday = iso === todayIso;
              const isSelectedDate = selectedDate === iso;

              let cell = 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300';
              if (booked) cell = 'bg-red-600 text-white hover:bg-red-700';
              else if (isPast) cell = 'bg-rose-200 text-rose-500';

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(iso, booked)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-md text-[13px] font-bold transition-colors active:scale-95 ${cell} ${
                    isSelectedDate ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                  } ${isToday && !isSelectedDate ? 'ring-2 ring-indigo-400 ring-inset' : ''}`}
                >
                  <span>{day}</span>
                  {booked && <span className="text-[6px] leading-none tracking-tighter sm:text-[8px] sm:leading-tight sm:tracking-tight font-black uppercase">Booked</span>}
                  {!booked && !isPast && <span className="text-[6px] leading-none tracking-tighter sm:text-[8px] sm:leading-tight sm:tracking-tight font-black uppercase opacity-70">Available</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-600" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-200" /> Past</span>
          </div>

          {/* 6a. Inline booking details for a selected RED date */}
          {selectedBooking && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-red-700">Booking Details</h4>
                <button onClick={() => setSelectedBooking(null)} className="text-red-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <DetailTile label="Party Name" value={selectedBooking.party_name} />
                <DetailTile label="Programme Name" value={selectedBooking.event_name} />
                <DetailTile label="Committee Name" value={selectedBooking.committee_name} />
                <DetailTile label="Committee Address" value={selectedBooking.committee_address || selectedBooking.event_address} />
                <DetailTile label="Booking Date" value={formatDateLabel(selectedBooking.booking_date)} />
                <DetailTile
                  label="Booking Status"
                  value={
                    <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-black uppercase text-red-700">
                      {selectedBooking.status}
                    </span>
                  }
                />
                {selectedBooking.contact_number && <DetailTile label="Contact" value={selectedBooking.contact_number} />}
                {selectedBooking.remarks && <DetailTile label="Remarks" value={selectedBooking.remarks} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => adminAlert({
                    title: 'Booking Record',
                    type: 'info',
                    message: (
                      <div className="space-y-1 text-left text-sm">
                        <p><b>Programme:</b> {selectedBooking.event_name}</p>
                        <p><b>Venue:</b> {selectedBooking.event_address}</p>
                        <p><b>Committee:</b> {selectedBooking.committee_name} ({selectedBooking.committee_id})</p>
                        <p><b>Date:</b> {formatDateLabel(selectedBooking.booking_date)}</p>
                        {selectedBooking.contact_number && <p><b>Contact:</b> {selectedBooking.contact_number}</p>}
                        {selectedBooking.remarks && <p><b>Remarks:</b> {selectedBooking.remarks}</p>}
                        <p className="text-xs text-slate-500">Created {selectedBooking.created_at ? new Date(selectedBooking.created_at).toLocaleString('en-IN') : '—'}</p>
                      </div>
                    ),
                  })}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-700 hover:bg-red-100"
                >
                  View Booking
                </button>
                <button
                  onClick={() => handleCancelBooking(selectedBooking)}
                  disabled={cancelling}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Cancel Booking
                </button>
              </div>
            </div>
          )}

          {/* 6b. Inline empty-date hint → create booking */}
          {selectedDate && !selectedBooking && !modalOpen && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-sm font-bold text-emerald-800">{formatDateLabel(selectedDate)} is available.</span>
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-[#10b981] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white hover:bg-emerald-600"
              >
                Create Booking
              </button>
            </div>
          )}

          {/* Booking history */}
          {historyOpen && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-600">
                Cancelled Booking History — never deleted
              </h4>
              {loadingHistory ? (
                <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                </div>
              ) : !history || history.length === 0 ? (
                <p className="py-2 text-sm font-medium text-slate-500">No cancelled bookings recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-slate-800">{h.event_name}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                          Cancelled {h.cancelled_at ? new Date(h.cancelled_at).toLocaleDateString('en-IN') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {h.committee_name} · {formatDateLabel(h.booking_date)} · {h.event_address}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <Theater className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Select a party to open its booking calendar</p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {loadingStats
              ? 'Loading booking statistics…'
              : `Overall: ${globalStats.totalBookings} confirmed bookings, ${globalStats.upcomingBookings} upcoming across ${globalStats.totalParties} parties.`}
          </p>
        </div>
      )}

      {/* Create Booking Modal */}
      {modalOpen && selectedParty && selectedDate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-[#ec4899] to-[#be185d] px-4 py-3 text-white">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">Create Party Booking</h3>
                <p className="text-[11px] font-medium opacity-90">Confirmed bookings sync live to the Customer Project</p>
              </div>
              <button onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* A. Party Details */}
              <div>
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#ec4899]">Party Details</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Party Name</p>
                    <p className="text-sm font-bold text-slate-800">{selectedParty.name}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Party ID</p>
                    <p className="break-all font-mono text-xs font-bold text-slate-800">{selectedParty.id}</p>
                  </div>
                </div>
              </div>

              {/* B. Booking Details */}
              <div>
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#10b981]">Booking Details</h4>
                <div className="space-y-3">
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-emerald-600">Booking Date</p>
                    <p className="text-sm font-bold text-emerald-900">{formatDateLabel(selectedDate)}</p>
                  </div>

                  <div className="relative">
                    <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                      {isSuperAdmin ? 'Committee Name *' : 'Booking Committee'}
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={form.committeeName}
                        readOnly={!isSuperAdmin}
                        onChange={(e) => {
                          if (!isSuperAdmin) return;
                          setForm((f) => ({ ...f, committeeName: e.target.value }));
                          setCommitteeSearch(e.target.value);
                          setCommitteeDropdownOpen(true);
                        }}
                        onFocus={() => isSuperAdmin && setCommitteeDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setCommitteeDropdownOpen(false), 150)}
                        placeholder={isSuperAdmin ? 'Search committees from past events…' : session?.committee?.committeeName || 'Your committee'}
                        className={`${inputCls} ${isSuperAdmin ? 'pl-8' : ''}`}
                      />
                    </div>
                    {isSuperAdmin && committeeDropdownOpen && filteredCommittees.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredCommittees.map((c) => (
                          <button
                            key={c.name.toUpperCase()}
                            type="button"
                            onMouseDown={() => {
                              setForm((f) => ({ ...f, committeeName: c.name, committeeAddress: f.committeeAddress || c.location || '' }));
                              setCommitteeDropdownOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-pink-50"
                          >
                            {c.name}
                            {c.location && <span className="block text-[11px] font-medium text-slate-400">{c.location}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {isSuperAdmin && committeeOptions.length === 0 && (
                      <p className="mt-1 text-[11px] font-medium text-slate-400">No committees found in events yet — type any committee name.</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                      Committee Address
                    </label>
                    <input
                      value={form.committeeAddress}
                      onChange={(e) => setForm((f) => ({ ...f, committeeAddress: e.target.value }))}
                      placeholder="Committee location (optional)"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                      Programme / Event Name *
                    </label>
                    <input
                      value={form.eventName}
                      onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
                      placeholder="e.g. Okoy Hirla Rechom Bagiyanj Kan"
                      className={inputCls}
                    />
                  </div>

                  <p className="text-[11px] font-medium text-slate-400">
                    Venue is taken from the party's own address.
                  </p>
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  {formError}
                </div>
              )}

              {/* C. Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#ec4899] px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:bg-[#be185d] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub components ─────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'pink' | 'green';
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div
        className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${
          tone === 'pink' ? 'bg-[#ec4899]/10 text-[#ec4899]' : 'bg-[#10b981]/10 text-[#10b981]'
        }`}
      >
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}

function DetailTile({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </p>
      <div className={`mt-0.5 text-sm font-bold text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function PartyCombobox({
  parties,
  selected,
  onSelect,
}: {
  parties: PartyItem[];
  selected: PartyItem | null;
  onSelect: (p: PartyItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = q ? parties.filter((p) => p.name.toUpperCase().includes(q)) : parties;
    if (selected) {
      // keep the selected party pinned at the top
      const rest = list.filter((p) => p.id !== selected.id);
      return (list.some((p) => p.id === selected.id) ? [selected] : []).concat(rest);
    }
    return list;
  }, [parties, query, selected]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#ec4899]"
      >
        <span className="flex items-center gap-2 truncate">
          <Theater className="h-4 w-4 shrink-0 text-[#ec4899]" />
          <span className={`truncate text-sm font-bold ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
            {selected ? selected.name : 'Search and select a registered party…'}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search party by name…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#ec4899] focus:bg-white"
              />
            </div>
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
                setQuery('');
              }}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-slate-400 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Clear selection (show overall stats)
            </button>
          )}
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-medium text-slate-400">No parties match “{query}”.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-pink-50 ${
                    selected?.id === p.id ? 'bg-pink-50 text-[#be185d]' : 'text-slate-700'
                  }`}
                >
                  <CalendarCheck className="h-4 w-4 shrink-0 text-[#10b981]" />
                  <span className="truncate">{p.name}</span>
                  {p.location && <span className="ml-auto hidden shrink-0 text-[11px] font-medium text-slate-400 sm:block">{p.location}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
