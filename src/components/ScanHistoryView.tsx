'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  CalendarDays,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  RotateCw,
} from 'lucide-react';
import { TicketEntry, ScannerMember, BookingItem } from '@/types';
import * as fs from '@/lib/firestore';


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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.filter((e) => e.scanResult !== 'INVALID');

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
  }, [entries, search, memberNameOf]);

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

  const clearSearch = () => {
    setSearch('');
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Scan History
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Every ticket scan (successful and rejected) is recorded here.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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
            onClick={clearSearch}
            className="text-xs font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
          >
            Clear Search
          </button>
        </div>
      </div>

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

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket #, member name, scanner ID..."
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

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
          <div className="hidden md:grid grid-cols-6 gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <div>Scanned By</div>
            <div>Scanner</div>
            <div>Ticket</div>
            <div>Gate</div>
            <div>Qty</div>
            <div className="text-right">Scanned At</div>
          </div>
          <div className="divide-y divide-slate-200 max-h-[60vh] overflow-y-auto">
            {filtered.map((e, i) => {
              return (
                <div key={e.id || i} className="grid grid-cols-2 md:grid-cols-6 gap-2 px-4 py-2.5 items-center hover:bg-slate-50/70 transition-colors text-xs">
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
                  <div className="font-mono font-black text-slate-800">
                    {e.seat && (
                      <div className="text-[10px] text-slate-400 font-sans font-bold">
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
                  <div className="text-right text-slate-500 font-semibold">{fmt(e.scannedAt, e.scanTime, e.scanDate)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
