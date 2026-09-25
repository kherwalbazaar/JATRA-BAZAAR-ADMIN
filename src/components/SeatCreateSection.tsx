'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, LayoutGrid, Plus, ChevronDown, Check } from 'lucide-react';
import { Seat, TicketType } from '@/types';

const BLOCK_OPTIONS = [
  'A', 'B', 'C', 'D',
  'A1', 'A2', 'A3',
  'B1', 'B2', 'B3',
  'C1', 'C2', 'C3',
  'D1', 'D2', 'D3',
  'Gallery', 'Standing', 'Ground',
];

interface SeatCreateSectionProps {
  currentEventId?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  onCreateSeatRow: (params: {
    eventId: string;
    blockId: string;
    rowId: string;
    totalSeats: number;
    price?: number;
  }) => Promise<number>;
  onDeleteSeatRow: (params: { eventId: string; blockId: string; rowId: string }) => Promise<void>;
}

export default function SeatCreateSection({
  currentEventId,
  seats,
  ticketTypes,
  onCreateSeatRow,
  onDeleteSeatRow,
}: SeatCreateSectionProps) {
  const [block, setBlock] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [row, setRow] = useState('');
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const blockWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!blockOpen) return;
    const onDown = (e: MouseEvent) => {
      if (blockWrapRef.current && !blockWrapRef.current.contains(e.target as Node)) {
        setBlockOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlockOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [blockOpen]);

  const blockFromTypes = useMemo(() => {
    const set = new Set<string>(BLOCK_OPTIONS);
    ticketTypes.forEach((t) => (t.blocks || []).forEach((b) => set.add(b)));
    return Array.from(set);
  }, [ticketTypes]);

  const rowsByBlock = useMemo(() => {
    const map = new Map<string, Map<string, Seat[]>>();
    seats.forEach((s) => {
      if (!map.has(s.blockId)) map.set(s.blockId, new Map());
      const rows = map.get(s.blockId)!;
      if (!rows.has(s.rowId)) rows.set(s.rowId, []);
      rows.get(s.rowId)!.push(s);
    });
    map.forEach((rows) => {
      rows.forEach((list) => list.sort((a, b) => a.seatNumber - b.seatNumber));
    });
    return map;
  }, [seats]);

  const preview = useMemo(() => {
    const n = Math.max(0, Math.min(200, Number(total) || 0));
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [total]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEventId) {
      setMsg('Select an event first.');
      return;
    }
    const b = block.trim().toUpperCase();
    const r = row.trim().toUpperCase();
    const n = Number(total);
    if (!b || !r || !n) {
      setMsg('Block, Row and Total seats are required.');
      return;
    }
    if (n < 1) {
      setMsg('Total seats must be at least 1.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const created = await onCreateSeatRow({
        eventId: currentEventId,
        blockId: b,
        rowId: r,
        totalSeats: n,
        price: ticketTypes[0]?.price || 100,
      });
      setMsg(`Created ${created} seats — Block ${b}, Row ${r} (1…${created}).`);
      setBlock('');
      setRow('');
      setTotal(0);
    } catch (err) {
      console.error('createSeatRow failed:', err);
      setMsg('Failed to create seats. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRow = async (blockId: string, rowId: string) => {
    if (!currentEventId) return;
    if (!window.confirm(`Delete Block ${blockId} Row ${rowId} (all seats)?`)) return;
    setBusy(true);
    try {
      await onDeleteSeatRow({ eventId: currentEventId, blockId, rowId });
      setMsg(`Deleted Block ${blockId} Row ${rowId}.`);
    } catch (err) {
      console.error('deleteSeatRow failed:', err);
      setMsg('Failed to delete row.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !!currentEventId && !busy && !!block.trim() && !!row.trim() && Number(total) > 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden relative">
      {blockOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/15 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}
      <form
        id="create-seat-form"
        onSubmit={handleCreate}
        className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Block Category *</label>
          <div ref={blockWrapRef} className="relative">
            <button
              type="button"
              onClick={() => setBlockOpen((o) => !o)}
              className={`w-full px-3 py-2.5 border rounded-xl text-xs font-bold outline-none text-left flex items-center justify-between gap-2 transition-colors ${
                block
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              } ${blockOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : ''}`}
            >
              <span className="truncate">{block || 'Select block'}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${blockOpen ? 'rotate-180' : ''}`} />
            </button>
            {blockOpen && (
              <div className="absolute z-30 left-0 sm:left-6 right-0 sm:right-auto sm:w-[min(92vw,560px)] mt-1.5 bg-slate-500 border border-slate-600 rounded-xl shadow-lg shadow-slate-300/60 p-2">
                <div className="grid grid-cols-7 gap-1.5">
                  {blockFromTypes.map((b) => {
                    const selected = block === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setBlock(b);
                          setBlockOpen(false);
                        }}
                        className={`relative px-1 py-1.5 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${
                          selected
                            ? 'bg-[#4f39f6] text-white border-[#4f39f6] shadow-md shadow-indigo-600/30'
                            : 'bg-white/95 text-slate-700 border-white hover:bg-white'
                        }`}
                      >
                        {selected && (
                          <Check className="w-2.5 h-2.5 absolute top-0.5 right-0.5" />
                        )}
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Row *</label>
          <input
            type="text"
            required
            value={row}
            onChange={(e) => setRow(e.target.value)}
            placeholder="Select row"
            maxLength={4}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 uppercase"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Total Seats *</label>
          <input
            type="number"
            required
            min={1}
            max={200}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#4f39f6] hover:bg-[#432ee0] text-white shadow-md active:scale-95'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {busy ? 'Creating…' : 'Create Seats'}
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-h-[42px] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase text-slate-400 block">Preview</span>
              <span className="text-[10px] font-bold text-slate-700 break-all">
                {block.toUpperCase() || '—'} / Row {row.toUpperCase() || '—'} →{' '}
                {preview.length
                  ? preview.slice(0, 8).join(', ') + (preview.length > 8 ? ` … ${preview[preview.length - 1]}` : '')
                  : '—'}
              </span>
            </div>
            <span className="flex-shrink-0 text-[10px] bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {seats.length} Seats
            </span>
          </div>
        </div>
      </form>

      {msg && (
        <div className="px-5 pb-3">
          <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            {msg}
          </p>
        </div>
      )}

      {/* Existing rows */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-400">Created Rows</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Available
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Booked
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              Reserved
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Blocked
            </span>
          </div>
        </div>
        {rowsByBlock.size === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-3">No seats created yet for this event.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(rowsByBlock.entries()).map(([blockId, rows]) => (
              <div key={blockId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-indigo-50 border-b border-indigo-100 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-800">Block {blockId}</span>
                  <span className="inline-block bg-indigo-600 text-white border border-indigo-700 rounded px-2 py-0.5 text-[10px] font-bold leading-none">
                    {Array.from(rows.values()).reduce((s, list) => s + list.length, 0)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from(rows.entries()).map(([rowId, list]) => (
                    <div key={rowId} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-slate-700">Row {rowId}</span>
                        {list.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                              s.status === 'available'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            {s.seatNumber}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none">
                          {list.length}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteRow(blockId, rowId)}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 inline-flex items-center justify-center transition-colors disabled:opacity-40"
                          aria-label={`Delete row ${rowId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
