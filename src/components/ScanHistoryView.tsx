'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  RotateCw,
  MoreVertical,
  Eye,
  Trash2,
  Pencil,
  X,
  AlertTriangle,
  Copy,
  Check,
  Ticket,
} from 'lucide-react';
import { TicketEntry, ScannerMember, BookingItem } from '@/types';
import * as fs from '@/lib/firestore';

function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOfEntry(e: TicketEntry): string {
  if (e.scanDate && /^\d{4}-\d{2}-\d{2}$/.test(e.scanDate)) return e.scanDate;
  if (e.scannedAt) {
    try {
      return localDateStr(new Date(e.scannedAt));
    } catch {
      return e.scannedAt.slice(0, 10);
    }
  }
  return (e as TicketEntry & { date?: string }).date || '';
}

function todayStr(): string {
  return localDateStr(new Date());
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}


function fmt(iso?: string, scanTime?: string, scanDate?: string): string {
  if (scanTime) {
    return `${scanDate ? `${scanDate} ` : ''}${scanTime}`;
  }
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ScanHistoryView() {
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [members, setMembers] = useState<ScannerMember[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  // Filters (toggled from the header)
  const [showFilters, setShowFilters] = useState(false);
  const [range, setRange] = useState<'today' | 'yesterday' | 'all' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [scannerId, setScannerId] = useState('');
  const [gateId, setGateId] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [eventId, setEventId] = useState('');

  const loadData = async () => {
    try {
      const data = await fs.getTicketEntriesOnce();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load ticket entries once:', err);
    }
    try {
      const bs = await fs.getAllBookingsOnce();
      setBookings(bs);
    } catch (err) {
      console.error('Failed to load bookings once:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 3-Dot Actions & Modals state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<TicketEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TicketEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TicketEntry | null>(null);
  const [editForm, setEditForm] = useState({
    audienceName: '',
    gateId: '',
    seat: '',
    persons: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Close 3-dot menus on click outside
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && !target.closest('[data-action-menu]')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    setIsSubmitting(true);
    try {
      await fs.deleteTicketEntry(deletingEntry);
      setEntries((prev) =>
        prev.filter((item) => (item.id || item.ticketId) !== (deletingEntry.id || deletingEntry.ticketId))
      );
      setToast({ type: 'success', message: 'Scan entry deleted successfully.' });
      setDeletingEntry(null);
    } catch (err) {
      console.error('Failed to delete scan entry:', err);
      setToast({ type: 'error', message: 'Failed to delete scan entry.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editingEntry.id) return;
    setIsSubmitting(true);
    try {
      const patch: Partial<TicketEntry> = {
        audienceName: editForm.audienceName.trim(),
        gateId: editForm.gateId.trim(),
        seat: editForm.seat.trim() || undefined,
        persons: Number(editForm.persons) || 1,
      };
      await fs.updateTicketEntry(editingEntry.id, patch);
      setEntries((prev) =>
        prev.map((item) => (item.id === editingEntry.id ? { ...item, ...patch } : item))
      );
      setToast({ type: 'success', message: 'Scan record updated successfully.' });
      setEditingEntry(null);
    } catch (err) {
      console.error('Failed to update scan entry:', err);
      setToast({ type: 'error', message: 'Failed to update scan record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(
        fs.listenTicketEntries(
          (e) => {
            setEntries(e);
            setLoading(false);
          },
          () => setLoading(false)
        )
      );
    } catch {
      setLoading(false);
    }
    try {
      unsubs.push(fs.listenScannerMembers(setMembers, () => {}));
    } catch {
      /* ignore */
    }
    try {
      unsubs.push(fs.listenAllBookings(setBookings, () => {}));
    } catch {
      /* ignore */
    }
    return () => unsubs.forEach((u) => u());
  }, []);

  // Resolves the scanner member who owns the scanner ID (from `scannerMembers`), fallback to the entry's stored name.
  const memberOf = useMemo(() => {
    const byKey = new Map<string, ScannerMember>();
    for (const m of members) {
      if (m.id) byKey.set(m.id, m);
      if (m.scannerId) byKey.set(m.scannerId, m);
    }
    return (e: TicketEntry) =>
      byKey.get(e.memberId || '') || byKey.get(e.scannerId || '') || null;
  }, [members]);

  const memberNameOf = useMemo(
    () => (e: TicketEntry) => memberOf(e)?.name || e.scannerName || '',
    [memberOf]
  );

  // Legacy scan docs (written by the older scanner client) have no `scanResult` —
  // they carry `status: 'entered'` instead, so treat them as successful scans.
  type LegacyEntry = TicketEntry & { status?: string; gate?: string; quantity?: number };

  const isSuccessScan = (e: TicketEntry) => {
    const x = e as LegacyEntry;
    if (e.scanResult) return e.scanResult === 'SUCCESS';
    return e.entryStatus === 'entered' || x.status === 'entered';
  };

  const gateOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => (e as LegacyEntry).gate || e.gateId).filter(Boolean))) as string[],
    [entries]
  );
  const eventOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.eventId).filter(Boolean))) as string[],
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.filter((e) => e.scanResult !== 'INVALID');

    if (range === 'today') {
      const t = todayStr();
      list = list.filter((e) => dateOfEntry(e) === t);
    } else if (range === 'yesterday') {
      const y = yesterdayStr();
      list = list.filter((e) => dateOfEntry(e) === y);
    } else if (range === 'custom' && customFrom && customTo) {
      list = list.filter((e) => {
        const d = dateOfEntry(e);
        return d >= customFrom && d <= customTo;
      });
    }

    if (scannerId) list = list.filter((e) => e.scannerId === scannerId);
    if (gateId) list = list.filter((e) => ((e as LegacyEntry).gate || e.gateId) === gateId);
    if (resultFilter) {
      list = list.filter((e) => {
        const r = e.scanResult || (isSuccessScan(e) ? 'SUCCESS' : '');
        return r === resultFilter;
      });
    }
    if (eventId) list = list.filter((e) => e.eventId === eventId);

    if (q) {
      list = list.filter(
        (e) =>
          (e.ticketId || '').toLowerCase().includes(q) ||
          (e.ticketNumber || '').toLowerCase().includes(q) ||
          (e.bookingId || '').toLowerCase().includes(q) ||
          (e.audienceName || '').toLowerCase().includes(q) ||
          (e.scannerId || '').toLowerCase().includes(q) ||
          (e.scannerName || '').toLowerCase().includes(q) ||
          memberNameOf(e).toLowerCase().includes(q) ||
          (e.seat || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [
    entries,
    search,
    memberNameOf,
    range,
    customFrom,
    customTo,
    scannerId,
    gateId,
    resultFilter,
    eventId,
    isSuccessScan,
  ]);

  // Total booked seats across all bookings (cancelled/refunded excluded).
  const bookedSeats = useMemo(
    () =>
      bookings.reduce((sum, b) => {
        if (b.status === 'Cancelled' || b.status === 'Refunded') return sum;
        const seats = Array.isArray(b.seats) ? b.seats.length : 0;
        return sum + (seats || Number(b.quantity) || 1);
      }, 0),
    [bookings]
  );

  const summary = useMemo(() => {
    const scanned = entries
      .filter(isSuccessScan)
      .reduce((s, e) => s + (e.persons || (e as LegacyEntry).quantity || 1), 0);
    return {
      booked: bookedSeats,
      scanned,
      remaining: Math.max(bookedSeats - scanned, 0),
    };
  }, [entries, bookedSeats]);

  const clearFilters = () => {
    setSearch('');
    setRange('all');
    setCustomFrom('');
    setCustomTo('');
    setScannerId('');
    setGateId('');
    setResultFilter('');
    setEventId('');
  };

  const activeFilters =
    range !== 'all' || !!scannerId || !!gateId || !!resultFilter || !!eventId || !!customFrom || !!customTo;

  return (
    <div className="p-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Booked Seats', value: summary.booked, cls: 'text-indigo-600 bg-indigo-50', icon: <Filter className="w-4 h-4" /> },
          { label: 'Scanned', value: summary.scanned, cls: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Remaining', value: summary.remaining, cls: 'text-blue-600 bg-blue-50', icon: <CalendarDays className="w-4 h-4" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.cls}`}>{s.icon}</div>
            <div>
              <span className="text-lg font-black text-slate-900 leading-none block">{s.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: search + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start sm:self-auto">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket #, member name, scanner ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          title="Refresh scan history"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl transition-colors border ${
            showFilters || activeFilters
              ? 'text-indigo-700 bg-indigo-100 border-indigo-200'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border-transparent'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filter
          {activeFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Date Range</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as typeof range)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="all">All</option>
                <option value="today">Today</option>
                <option value="yesterday">Yest.</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {range === 'custom' && (
              <>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scanner</label>
              <select
                value={scannerId}
                onChange={(e) => setScannerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">All scanners</option>
                {members.map((m) => (
                  <option key={m.id} value={m.scannerId}>
                    {m.scannerId} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[130px]">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Gate</label>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">All gates</option>
                {gateOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Result</label>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">All results</option>
                <option value="SUCCESS">Entry Allowed</option>
                <option value="ALREADY_USED">Already Used</option>
                <option value="WRONG_EVENT">Wrong Event</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="UNPAID">Unpaid</option>
                <option value="SCANNER_DENIED">Scanner Blocked</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">All events</option>
                {eventOptions.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[130px] flex items-end">
              <button
                onClick={clearFilters}
                className="w-full text-xs font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 py-10 justify-center">
          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading scan history...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600">No scans found</p>
          <p className="text-xs text-slate-400 font-semibold mt-1">Try a different search or wait for scans to come in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="hidden md:grid grid-cols-7 gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <div>Scanned By</div>
            <div>Scanner</div>
            <div>Ticket / Seat</div>
            <div>Gate</div>
            <div>Qty</div>
            <div>Scanned At</div>
            <div className="text-right pr-2">Actions</div>
          </div>
          <div className="divide-y divide-slate-200 max-h-[60vh] overflow-y-auto">
            {filtered.map((e, i) => {
              const entryKey = e.id || `entry-${i}`;
              return (
                <div key={entryKey} className="grid grid-cols-2 md:grid-cols-7 gap-2 px-4 py-2.5 items-center hover:bg-slate-50/70 transition-colors text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {(() => {
                      const m = memberOf(e);
                      const name = memberNameOf(e) || '—';
                      const photo = m?.profilePhoto || '';
                      const initials = name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join('');
                      return (
                        <>
                          <span className="relative shrink-0 w-7 h-7 rounded-full overflow-hidden bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black border border-indigo-200">
                            {initials || '?'}
                            {photo && (
                              <img
                                src={photo}
                                alt={name}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(ev) => {
                                  ev.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </span>
                          <span className="font-bold text-slate-700 truncate">{name}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <span className="font-black text-indigo-700 font-mono text-[11px]">{e.scannerId}</span>
                  </div>
                  <div className="font-mono font-black text-slate-800 min-w-0">
                    <span className="truncate block" title={e.ticketId || e.ticketNumber || ''}>
                      {e.ticketId || e.ticketNumber || '—'}
                    </span>
                    {e.seat && (
                      <div className="text-[10px] text-slate-400 font-sans font-bold mt-0.5">
                        Seat:{' '}
                        <span className="inline-block bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-px rounded font-black">
                          {e.seat}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-slate-600">
                    {e.gateId || (e as LegacyEntry).gate || '—'}
                  </div>
                  <div className="font-bold text-slate-600">{e.persons || 1}</div>
                  <div className="text-slate-500 font-semibold">{fmt(e.scannedAt, e.scanTime, e.scanDate)}</div>
                  <div className="text-right flex justify-end">
                    <div data-action-menu className="relative flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setActiveMenuId(activeMenuId === entryKey ? null : entryKey);
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-slate-200/70 active:bg-slate-300/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                        title="Actions"
                        aria-label="Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === entryKey && (
                        <div
                          className="absolute right-0 top-full mt-1 z-30 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-left animate-in fade-in"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setViewingEntry(e);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEntry(e);
                              setEditForm({
                                audienceName: e.audienceName || '',
                                gateId: e.gateId || (e as LegacyEntry).gate || '',
                                seat: e.seat || '',
                                persons: e.persons || 1,
                              });
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingEntry(e);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Scan Details Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setViewingEntry(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">Scan Record Details</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Gate verification & audit history</p>
                </div>
              </div>
              <button
                onClick={() => setViewingEntry(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Status Badge Banner */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Scan Status:</span>
                  {(() => {
                    const res = viewingEntry.scanResult || (isSuccessScan(viewingEntry) ? 'SUCCESS' : 'REJECTED');
                    if (res === 'SUCCESS') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Entry Allowed
                        </span>
                      );
                    }
                    if (res === 'ALREADY_USED') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Already Scanned
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                        <X className="w-3.5 h-3.5 text-rose-600" /> {res}
                      </span>
                    );
                  })()}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Qty: <strong className="text-slate-800">{viewingEntry.persons || 1}</strong>
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ticket Number / ID</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 truncate">{viewingEntry.ticketId || viewingEntry.ticketNumber || '—'}</span>
                    {(viewingEntry.ticketId || viewingEntry.ticketNumber) && (
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingEntry.ticketId || viewingEntry.ticketNumber)}
                        className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy"
                      >
                        {copiedText === (viewingEntry.ticketId || viewingEntry.ticketNumber) ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Booking ID</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 truncate">{viewingEntry.bookingId || '—'}</span>
                    {viewingEntry.bookingId && (
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingEntry.bookingId)}
                        className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy"
                      >
                        {copiedText === viewingEntry.bookingId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Audience Name</span>
                  <span className="font-bold text-slate-800">{viewingEntry.audienceName || '—'}</span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Seat Number</span>
                  {viewingEntry.seat ? (
                    <span className="inline-block bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-black font-mono">
                      {viewingEntry.seat}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-400">General / Open</span>
                  )}
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scanner ID</span>
                  <span className="font-mono font-black text-indigo-700">{viewingEntry.scannerId || '—'}</span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scanned By Member</span>
                  <span className="font-bold text-slate-800">{memberNameOf(viewingEntry) || viewingEntry.scannerName || '—'}</span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Gate</span>
                  <span className="font-bold text-slate-800">{viewingEntry.gateId || (viewingEntry as LegacyEntry).gate || '—'}</span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scanned At</span>
                  <span className="font-semibold text-slate-800">{fmt(viewingEntry.scannedAt, viewingEntry.scanTime, viewingEntry.scanDate)}</span>
                </div>
              </div>

              {/* Previous Scan Details (if duplicate attempt) */}
              {viewingEntry.previousEntryTime && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-1">
                  <span className="text-[11px] font-black uppercase text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    Prior Scan Entry Info
                  </span>
                  <p className="text-xs text-amber-800 font-medium">
                    Ticket was originally scanned at: <strong>{viewingEntry.previousEntryTime}</strong>
                    {viewingEntry.previousScannerName && ` by ${viewingEntry.previousScannerName}`}
                    {viewingEntry.previousGateId && ` at ${viewingEntry.previousGateId}`}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const cur = viewingEntry;
                  setViewingEntry(null);
                  setDeletingEntry(cur);
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = viewingEntry;
                    setViewingEntry(null);
                    setEditingEntry(cur);
                    setEditForm({
                      audienceName: cur.audienceName || '',
                      gateId: cur.gateId || (cur as LegacyEntry).gate || '',
                      seat: cur.seat || '',
                      persons: cur.persons || 1,
                    });
                  }}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-200/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingEntry(null)}
                  className="text-xs font-black text-white bg-slate-800 hover:bg-slate-900 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Scan Record Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => !isSubmitting && setEditingEntry(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">Edit Scan Record</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Ticket #{editingEntry.ticketId || editingEntry.ticketNumber || editingEntry.id}</p>
                </div>
              </div>
              <button
                onClick={() => !isSubmitting && setEditingEntry(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Audience / Customer Name</label>
                <input
                  type="text"
                  value={editForm.audienceName}
                  onChange={(e) => setEditForm((f) => ({ ...f, audienceName: e.target.value }))}
                  placeholder="Attendee Name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Gate</label>
                  <input
                    type="text"
                    value={editForm.gateId}
                    onChange={(e) => setEditForm((f) => ({ ...f, gateId: e.target.value }))}
                    placeholder="e.g. Gate 1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Seat</label>
                  <input
                    type="text"
                    value={editForm.seat}
                    onChange={(e) => setEditForm((f) => ({ ...f, seat: e.target.value }))}
                    placeholder="e.g. A-12"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Persons / Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editForm.persons}
                  onChange={(e) => setEditForm((f) => ({ ...f, persons: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => !isSubmitting && setDeletingEntry(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Delete Scan Record?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                Are you sure you want to delete the scan entry for ticket{' '}
                <strong className="text-slate-800 font-mono">#{deletingEntry.ticketId || deletingEntry.ticketNumber || deletingEntry.id}</strong>?
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-left">
              <p className="text-[11px] text-amber-900 font-semibold leading-snug">
                Deleting this record will restore the ticket's valid entry status so it can be scanned again at the gate.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingEntry(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteEntry}
                className="flex-1 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 fade-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold text-white ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 p-0.5 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
