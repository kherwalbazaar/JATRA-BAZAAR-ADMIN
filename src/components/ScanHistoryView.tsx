'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  CalendarDays,
  Search,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Filter,
} from 'lucide-react';
import { TicketEntry, ScannerMember } from '@/types';
import * as fs from '@/lib/firestore';

const resultStyle: Record<string, { label: string; cls: string }> = {
  SUCCESS: { label: '✓ Entry Allowed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ALREADY_USED: { label: '⨯ Already Used', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  INVALID: { label: '⨯ Invalid', cls: 'bg-red-100 text-red-700 border-red-200' },
  WRONG_EVENT: { label: '⨯ Wrong Event', cls: 'bg-red-100 text-red-700 border-red-200' },
  CANCELLED: { label: '⨯ Cancelled', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  UNPAID: { label: '⨯ Unpaid', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  SCANNER_DENIED: { label: '⨯ Scanner Blocked', cls: 'bg-red-100 text-red-700 border-red-200' },
};

function dateOf(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function fmt(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScanHistoryView() {
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [members, setMembers] = useState<ScannerMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<'today' | 'yesterday' | 'all' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [scannerId, setScannerId] = useState('');
  const [gateId, setGateId] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(fs.listenTicketEntries((e) => { setEntries(e); setLoading(false); }, () => setLoading(false)));
    } catch {
      setLoading(false);
    }
    try {
      unsubs.push(fs.listenScannerMembers(setMembers, () => {}));
    } catch {
      /* ignore */
    }
    return () => unsubs.forEach((u) => u());
  }, []);

  const gateOptions = useMemo(() => Array.from(new Set(entries.map((e) => e.gateId).filter(Boolean))), [entries]);
  const eventOptions = useMemo(() => Array.from(new Set(entries.map((e) => e.eventId).filter(Boolean))), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries;

    if (range === 'today') {
      const t = todayStr();
      list = list.filter((e) => (e.scannedAt || '').startsWith(t));
    } else if (range === 'yesterday') {
      const y = yesterdayStr();
      list = list.filter((e) => (e.scannedAt || '').startsWith(y));
    } else if (range === 'custom' && customFrom && customTo) {
      list = list.filter((e) => {
        const d = dateOf(e.scannedAt);
        return d >= customFrom && d <= customTo;
      });
    }

    if (scannerId) list = list.filter((e) => e.scannerId === scannerId);
    if (gateId) list = list.filter((e) => e.gateId === gateId);
    if (resultFilter) list = list.filter((e) => e.scanResult === resultFilter);
    if (eventId) list = list.filter((e) => e.eventId === eventId);

    if (q) {
      list = list.filter(
        (e) =>
          (e.ticketId || '').toLowerCase().includes(q) ||
          (e.audienceName || '').toLowerCase().includes(q) ||
          (e.scannerId || '').toLowerCase().includes(q) ||
          (e.scannerName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, range, customFrom, customTo, scannerId, gateId, resultFilter, eventId, search]);

  const summary = useMemo(
    () => ({
      total: filtered.length,
      success: filtered.filter((e) => e.scanResult === 'SUCCESS').length,
      rejected: filtered.filter((e) => e.scanResult !== 'SUCCESS').length,
      people: filtered.filter((e) => e.scanResult === 'SUCCESS').reduce((s, e) => s + (e.persons || 0), 0),
    }),
    [filtered]
  );

  const clearFilters = () => {
    setRange('today');
    setCustomFrom('');
    setCustomTo('');
    setScannerId('');
    setGateId('');
    setResultFilter('');
    setEventId('');
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
        <button
          onClick={clearFilters}
          className="text-xs font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors self-start sm:self-auto"
        >
          Clear Filters
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Scans (filtered)', value: summary.total, cls: 'text-indigo-600 bg-indigo-50', icon: <Filter className="w-4 h-4" /> },
          { label: 'Successful', value: summary.success, cls: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Rejected', value: summary.rejected, cls: 'text-red-600 bg-red-50', icon: <XCircle className="w-4 h-4" /> },
          { label: 'People Entered', value: summary.people, cls: 'text-blue-600 bg-blue-50', icon: <CalendarDays className="w-4 h-4" /> },
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Date Range</label>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yest.' },
                { key: 'custom', label: 'Custom' },
                { key: 'all', label: 'All' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key as typeof range)}
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-colors ${
                    range === r.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {range === 'custom' && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
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

          <div>
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

          <div>
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

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Result</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="">All results</option>
              <option value="SUCCESS">Entry Allowed</option>
              <option value="ALREADY_USED">Already Used</option>
              <option value="INVALID">Invalid</option>
              <option value="WRONG_EVENT">Wrong Event</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="UNPAID">Unpaid</option>
              <option value="SCANNER_DENIED">Scanner Blocked</option>
            </select>
          </div>

          <div className="md:col-span-3 xl:col-span-1">
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
        </div>

        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket #, audience name, scanner ID..."
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
          <p className="text-xs text-slate-400 font-semibold mt-1">Adjust the filters or wait for scans to come in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <div className="col-span-2">Ticket</div>
            <div className="col-span-2">Audience</div>
            <div className="col-span-2">Scanner</div>
            <div className="col-span-1">Gate</div>
            <div className="col-span-2">Result</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-2">Scanned At</div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {filtered.map((e, i) => {
              const rs = resultStyle[e.scanResult] || resultStyle.INVALID;
              return (
                <div key={e.id || i} className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50/70 transition-colors text-xs">
                  <div className="md:col-span-2 font-mono font-black text-slate-800">{e.ticketId}</div>
                  <div className="md:col-span-2 font-bold text-slate-700 truncate">{e.audienceName || '—'}</div>
                  <div className="md:col-span-2">
                    <span className="font-black text-indigo-700 font-mono text-[11px]">{e.scannerId}</span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-1">{e.scannerName}</span>
                  </div>
                  <div className="md:col-span-1 font-bold text-slate-600">{e.gateId || '—'}</div>
                  <div className="md:col-span-2">
                    <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${rs.cls}`}>{rs.label}</span>
                  </div>
                  <div className="md:col-span-1 font-bold text-slate-600">{e.persons || 1}</div>
                  <div className="md:col-span-2 text-slate-500 font-semibold">{fmt(e.scannedAt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
