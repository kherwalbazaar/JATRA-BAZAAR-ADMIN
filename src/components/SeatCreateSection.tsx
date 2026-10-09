'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, LayoutGrid, Plus, ChevronDown, Check, MoreVertical, Edit, AlertTriangle, X } from 'lucide-react';
import { Seat, TicketType } from '@/types';

const BLOCK_OPTIONS = [
  'A1', 'A2', 'A3',
  'B1', 'B2', 'B3',
  'C1', 'C2', 'C3',
];

interface SeatCreateSectionProps {
  currentEventId?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  /** Popup visibility — controlled by the page's "Create Seat" button. */
  isOpen: boolean;
  onClose: () => void;
  /** Called when a row's Edit action should open the popup too. */
  onOpenRequest?: () => void;
  onCreateSeatRow: (params: {
    eventId: string;
    blockId: string;
    rowId: string;
    totalSeats: number;
    price?: number;
  }) => Promise<number>;
  onDeleteSeatRow: (params: { eventId: string; blockId: string; rowId: string }) => Promise<void>;
  /** Update an existing row (price) without touching booked seats. */
  onUpdateSeatRow: (params: {
    eventId: string;
    blockId: string;
    rowId: string;
    price?: number;
  }) => Promise<number>;
}

export default function SeatCreateSection({
  currentEventId,
  seats,
  ticketTypes,
  isOpen,
  onClose,
  onOpenRequest,
  onCreateSeatRow,
  onDeleteSeatRow,
  onUpdateSeatRow,
}: SeatCreateSectionProps) {
  const [block, setBlock] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [row, setRow] = useState('');
  const [rowOpen, setRowOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ blockId: string; rowId: string } | null>(null);
  const [editMode, setEditMode] = useState<{ blockId: string; rowId: string; oldTotal: number } | null>(null);
  const blockWrapRef = useRef<HTMLDivElement>(null);
  const rowWrapRef = useRef<HTMLDivElement>(null);

  // Close the Row alphabet dropdown on outside click / Esc
  useEffect(() => {
    if (!rowOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rowWrapRef.current && !rowWrapRef.current.contains(e.target as Node)) {
        setRowOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [rowOpen]);

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

  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close menu if clicking outside of menu and trigger button
      if (!target.closest('.menu-dropdown') && !target.closest('.menu-trigger')) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeleteConfirm(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [deleteConfirm]);

  // Popup: focus the first field as soon as it opens; Esc closes it
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#create-seat-form input, #create-seat-form button');
      el?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blockOpen && !rowOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, blockOpen, rowOpen]);

  const blockFromTypes = useMemo(() => {
    const set = new Set<string>(BLOCK_OPTIONS);
    ticketTypes.forEach((t) =>
      (t.blocks || []).forEach((b) => {
        if (b && b.toUpperCase() !== 'ALL') set.add(b);
      })
    );
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

  // Only the 9 catalog blocks are listed in the popup — legacy blocks like
  // "ALL" (or anything else outside A1–C3) are hidden from the Created Rows view.
  const visibleBlocks = useMemo(
    () =>
      Array.from(rowsByBlock.entries()).filter(([blockId]) =>
        BLOCK_OPTIONS.includes(blockId.toUpperCase())
      ),
    [rowsByBlock]
  );

  // Alphabet grid A…Z for the Row dropdown
  const ROW_OPTIONS = useMemo(
    () => Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    []
  );

  // Seats already created for a letter in the selected block — matches the
  // exact rowId ("A") and row groups sharing the base letter ("A1", "A2"…).
  const rowStatsFor = (letter: string) => {
    const rows = rowsByBlock.get(block.trim().toUpperCase());
    if (!rows) return null;
    const list: Seat[] = [];
    const matchedRows: string[] = [];
    rows.forEach((seatsOfRow, rowId) => {
      const base = rowId.replace(/[0-9]/g, '');
      if (rowId === letter || base === letter) {
        matchedRows.push(rowId);
        list.push(...seatsOfRow);
      }
    });
    if (!list.length) return null;
    return {
      total: list.length,
      available: list.filter((s) => s.status === 'available').length,
      matchedRows,
    };
  };

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
    const seatPrice = Number(price) > 0 ? Number(price) : ticketTypes[0]?.price || 100;
    try {
      if (editMode) {
        // Update mode: keep every existing seat as-is (bookings preserved),
        // only append missing seat numbers up to the new total + apply price.
        const created = await onCreateSeatRow({
          eventId: currentEventId,
          blockId: b,
          rowId: r,
          totalSeats: n,
          price: seatPrice,
        });
        const priced = await onUpdateSeatRow({
          eventId: currentEventId,
          blockId: b,
          rowId: r,
          price: seatPrice,
        });
        const parts: string[] = [];
        parts.push(created > 0 ? `added ${created} new seat${created > 1 ? 's' : ''}` : 'no new seats needed');
        parts.push(`price updated on ${priced} seat${priced === 1 ? '' : 's'} (₹${seatPrice})`);
        setMsg(`Updated Block ${b}, Row ${r} — ${parts.join(', ')} (Total: ${n}).`);
        setEditMode(null);
        setBlock('');
        setRow('');
        setTotal(0);
        setPrice(0);
      } else {
        // Create mode: seats that already exist in this row are skipped by
        // createSeatRow (never re-created, so booked status is untouched).
        const created = await onCreateSeatRow({
          eventId: currentEventId,
          blockId: b,
          rowId: r,
          totalSeats: n,
          price: seatPrice,
        });
        setMsg(
          created === n
            ? `Created ${created} seats — Block ${b}, Row ${r} (1…${n}) at ₹${seatPrice}.`
            : `Block ${b}, Row ${r}: created ${created} new seat${created === 1 ? '' : 's'}, skipped ${n - created} already existing (Total: ${n}).`
        );
        setBlock('');
        setRow('');
        setTotal(0);
        setPrice(0);
      }
    } catch (err) {
      console.error('createSeatRow failed:', err);
      setMsg('Failed to create seats. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRow = async (blockId: string, rowId: string, hasBookedSeats: boolean) => {
    if (!currentEventId) return;
    if (hasBookedSeats) {
      setMsg('Cannot delete row with booked seats. Delete booked tickets first.');
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }
    setDeleteConfirm({ blockId, rowId });
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const confirmDeleteRow = async () => {
    if (!deleteConfirm || !currentEventId) return;
    setBusy(true);
    try {
      await onDeleteSeatRow({ eventId: currentEventId, blockId: deleteConfirm.blockId, rowId: deleteConfirm.rowId });
      setMsg(`Deleted Block ${deleteConfirm.blockId} Row ${deleteConfirm.rowId}.`);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('deleteSeatRow failed:', err);
      setMsg('Failed to delete row.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditRow = (blockId: string, rowId: string, currentSeats: Seat[]) => {
    setBlock(blockId);
    setRow(rowId);
    setTotal(currentSeats.length);
    setPrice(Number(currentSeats[0]?.price) || ticketTypes[0]?.price || 100);
    setEditMode({ blockId, rowId, oldTotal: currentSeats.length });
    setOpenMenuId(null);
    setMenuPosition(null);
    setMsg(`Editing Block ${blockId} Row ${rowId}. Change the price or raise the seat count to add seats — existing seats are never overwritten.`);
    onOpenRequest?.();
  };

  const handleCancelEdit = () => {
    setEditMode(null);
    setBlock('');
    setRow('');
    setTotal(0);
    setPrice(0);
    setMsg('');
  };

  const canSubmit =
    !!currentEventId && !busy && !!block.trim() && !!row.trim() && Number(total) > 0 &&
    (!editMode || Number(total) >= editMode.oldTotal);

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden relative">
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative mx-auto my-6 w-[min(96vw,760px)] bg-white rounded-2xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">CREATE SEATS</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Block, row, count and price — seats that already exist are never re-created.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(blockOpen || rowOpen) && (
              <div
                className="fixed inset-0 z-20 bg-slate-900/15 backdrop-blur-[2px]"
                aria-hidden="true"
              />
            )}
            <form
              id="create-seat-form"
              onSubmit={handleCreate}
              className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
        {editMode && (
          <div className="sm:col-span-2 lg:col-span-5 mb-2">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-800">
                Editing Block {editMode.blockId} Row {editMode.rowId} (Current: {editMode.oldTotal} seats) — existing seats stay untouched; only new seats are added.
              </span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                Cancel Edit
              </button>
            </div>
          </div>
        )}
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
          <div ref={rowWrapRef} className="relative">
            <button
              type="button"
              onClick={() => setRowOpen((o) => !o)}
              className={`w-full px-3 py-2.5 border rounded-xl text-xs font-bold outline-none text-left flex items-center justify-between gap-2 transition-colors ${
                row
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              } ${rowOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : ''}`}
            >
              <span className="truncate">{row || 'Select row'}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${rowOpen ? 'rotate-180' : ''}`} />
            </button>
            {rowOpen && (
              <div className="absolute z-30 left-0 sm:left-6 right-0 sm:right-auto sm:w-[min(92vw,560px)] mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-300/60 p-2">
                {!block && (
                  <p className="text-[10px] font-bold text-amber-600 px-1 pb-1.5">
                    Select a block first — existing rows of that block will be locked here.
                  </p>
                )}
                <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1.5">
                  {ROW_OPTIONS.map((letter) => {
                    const stats = rowStatsFor(letter);
                    const editingThis =
                      !!editMode &&
                      (editMode.rowId === letter || editMode.rowId.replace(/[0-9]/g, '') === letter);
                    const disabled = !!stats && !editingThis;
                    const selected = row === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={disabled}
                        title={
                          disabled
                            ? `Row ${letter} already created — ${stats!.available}/${stats!.total} seats`
                            : stats
                              ? `Row ${letter}: ${stats.available}/${stats.total} seats`
                              : `Create row ${letter}`
                        }
                        onClick={() => {
                          if (disabled) return;
                          setRow(letter);
                          setRowOpen(false);
                        }}
                        className={`relative rounded-lg text-[11px] font-black border-2 overflow-hidden transition-all ${
                          selected
                            ? 'bg-[#4f39f6] text-white border-[#4f39f6] shadow-[0_4px_10px_-2px_rgba(79,57,246,0.55)]'
                            : disabled
                              ? 'bg-red-100 text-red-400 border-red-400 cursor-not-allowed shadow-[0_3px_6px_-1px_rgba(15,23,42,0.22)]'
                              : 'bg-white text-slate-700 border-emerald-400 hover:border-emerald-500 active:scale-95 shadow-[0_3px_6px_-1px_rgba(15,23,42,0.22)]'
                        }`}
                      >
                        {selected && <Check className="w-2.5 h-2.5 absolute top-0.5 right-0.5" />}
                        <span className={`block leading-none pt-1.5 px-1 ${disabled ? 'line-through' : ''}`}>
                          {letter}
                        </span>
                        <span
                          className={`block text-[8px] font-bold px-1 py-0.5 mt-1 rounded-t-none ${
                            selected
                              ? 'bg-indigo-500 text-white'
                              : disabled
                                ? 'bg-red-200 text-red-500'
                                : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {stats ? `${stats.available}/${stats.total}` : 'New'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
            {editMode ? `Total Seats (Current: ${editMode.oldTotal}) *` : 'Total Seats *'}
          </label>
          <input
            type="number"
            required
            min={editMode ? editMode.oldTotal : 1}
            max={200}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            placeholder={editMode ? `≥ ${editMode.oldTotal}` : 'Enter total seats'}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Price (₹) *</label>
          <input
            type="number"
            required
            min={1}
            value={price || ''}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder={String(ticketTypes[0]?.price || 100)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-end gap-2">
          {editMode && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={busy}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#4f39f6] hover:bg-[#432ee0] text-white shadow-md active:scale-95'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {editMode ? (
              <>
                <Edit className="w-3.5 h-3.5" />
                {busy ? 'Updating…' : 'Update Seats'}
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                {busy ? 'Creating…' : 'Create Seats'}
              </>
            )}
          </button>
        </div>
      </form>

      {msg && (
        <div className="px-5 pb-3">
          <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            {msg}
          </p>
        </div>
      )}
    </div>
    </div>
    )}

      {/* Existing rows */}
      <div className="px-5 pb-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-400">Created Rows</span>
            <span className="text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded-lg shadow-md shadow-indigo-600/30">
              Total Seat: <span className="font-black">{seats.length}</span>
            </span>
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
        {visibleBlocks.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-3">No seats created yet for this event.</p>
        ) : (
          <div className="space-y-3">
            {[...visibleBlocks].sort(([a], [b]) => {
              // Natural alphanumeric sort for block IDs
              const aParts = a.match(/([A-Za-z]+)(\d*)/);
              const bParts = b.match(/([A-Za-z]+)(\d*)/);
              
              if (aParts && bParts) {
                const aLetter = aParts[1];
                const bLetter = bParts[1];
                const aNum = aParts[2] ? parseInt(aParts[2]) : 0;
                const bNum = bParts[2] ? parseInt(bParts[2]) : 0;
                
                if (aLetter !== bLetter) {
                  return aLetter.localeCompare(bLetter);
                }
                return aNum - bNum;
              }
              return a.localeCompare(b);
            }).map(([blockId, rows]) => (
              <div key={blockId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-indigo-600 border-b border-indigo-700 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-black text-white">Block {blockId}</span>
                  <span className="inline-block bg-white text-indigo-700 border border-white rounded px-2 py-0.5 text-[10px] font-bold leading-none">
                    {Array.from(rows.values()).reduce((s, list) => s + list.length, 0)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    // Group rows by base identifier (e.g., "A" for "A1", "A2", "A3")
                    const groupedRows = new Map<string, { rowIds: string[]; rowIdNumbers: string[]; allSeats: Seat[]; totalSeats: number; hasBooked: boolean }>();
                    
                    Array.from(rows.entries()).forEach(([rowId, list]) => {
                      // Extract base row identifier (e.g., "A" from "A1", "A2")
                      const baseRowId = rowId.replace(/[0-9]/g, '');
                      
                      if (!groupedRows.has(baseRowId)) {
                        groupedRows.set(baseRowId, { rowIds: [], rowIdNumbers: [], allSeats: [], totalSeats: 0, hasBooked: false });
                      }
                      
                      const group = groupedRows.get(baseRowId)!;
                      group.rowIds.push(rowId);
                      group.allSeats.push(...list);
                      group.totalSeats += list.length;
                      group.hasBooked = group.hasBooked || list.some(s => s.status === 'booked');
                      
                      // Sort row IDs naturally (A1, A2, A3, etc.)
                      group.rowIds.sort((a, b) => {
                        const aParts = a.match(/([A-Za-z]+)(\d*)/);
                        const bParts = b.match(/([A-Za-z]+)(\d*)/);
                        
                        if (aParts && bParts) {
                          const aLetter = aParts[1];
                          const bLetter = bParts[1];
                          const aNum = aParts[2] ? parseInt(aParts[2]) : 0;
                          const bNum = bParts[2] ? parseInt(bParts[2]) : 0;
                          
                          if (aLetter !== bLetter) {
                            return aLetter.localeCompare(bLetter);
                          }
                          return aNum - bNum;
                        }
                        return a.localeCompare(b);
                      });
                      
                      // Sort seats within the group by seat number
                      group.allSeats.sort((a, b) => a.seatNumber - b.seatNumber);
                      
                      // Sort row IDs naturally (A1, A2, A3, etc.)
                      group.rowIds.sort((a, b) => {
                        const aParts = a.match(/([A-Za-z]+)(\d*)/);
                        const bParts = b.match(/([A-Za-z]+)(\d*)/);
                        
                        if (aParts && bParts) {
                          const aLetter = aParts[1];
                          const bLetter = bParts[1];
                          const aNum = aParts[2] ? parseInt(aParts[2]) : 0;
                          const bNum = bParts[2] ? parseInt(bParts[2]) : 0;
                          
                          if (aLetter !== bLetter) {
                            return aLetter.localeCompare(bLetter);
                          }
                          return aNum - bNum;
                        }
                        return a.localeCompare(b);
                      });
                      
                      // Sort seats within the group by seat number
                      group.allSeats.sort((a, b) => a.seatNumber - b.seatNumber);
                      
                      // Extract just the numbers for display (A1, A2, A3 → 1, 2, 3)
                      group.rowIdNumbers = group.rowIds.map(id => {
                        const parts = id.match(/([A-Za-z]+)(\d*)/);
                        return parts && parts[2] ? parts[2] : '';
                      });
                    });

                    // Sort groups by base row identifier (proper alphanumeric sort)
                    const sortedGroups = Array.from(groupedRows.entries()).sort(([a], [b]) => {
                      // Natural sort for alphanumeric strings
                      const aParts = a.match(/([A-Za-z]+)(\d*)/);
                      const bParts = b.match(/([A-Za-z]+)(\d*)/);
                      
                      if (aParts && bParts) {
                        const aLetter = aParts[1];
                        const bLetter = bParts[1];
                        const aNum = aParts[2] ? parseInt(aParts[2]) : 0;
                        const bNum = bParts[2] ? parseInt(bParts[2]) : 0;
                        
                        if (aLetter !== bLetter) {
                          return aLetter.localeCompare(bLetter);
                        }
                        return aNum - bNum;
                      }
                      return a.localeCompare(b);
                    });

                    return sortedGroups.map(([baseRowId, group]) => (
                      <div key={baseRowId} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black text-slate-700">Row {baseRowId} {group.rowIds.map(id => {
                            const parts = id.match(/([A-Za-z]+)(\d*)/);
                            return parts && parts[2] ? parts[2] : '';
                          }).join(',')}</span>
                          {group.allSeats.map((s) => (
                            <span
                              key={s.id}
                              className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                s.status === 'available'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : s.status === 'booked'
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : s.status === 'reserved'
                                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {s.seatNumber}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none">
                            {group.totalSeats}
                          </span>
                          <div className="relative">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                if (openMenuId === `${blockId}-${baseRowId}`) {
                                  setOpenMenuId(null);
                                  setMenuPosition(null);
                                } else {
                                  setOpenMenuId(`${blockId}-${baseRowId}`);
                                  setMenuPosition({ top: rect.bottom + 4, left: rect.right - 128 });
                                }
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center transition-colors disabled:opacity-40 menu-trigger"
                              aria-label={`Options for row group ${baseRowId}`}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {openMenuId === `${blockId}-${baseRowId}` && menuPosition && (
                              <div 
                                className="fixed w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-[9999] menu-dropdown" 
                                style={{ top: menuPosition.top, left: menuPosition.left }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Edit the first row in the group
                                    handleEditRow(blockId, group.rowIds[0], group.allSeats);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                >
                                  <Edit className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Delete all rows in the group
                                    group.rowIds.forEach(rowId => {
                                      handleDeleteRow(blockId, rowId, group.hasBooked);
                                    });
                                  }}
                                  disabled={group.hasBooked}
                                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-2 ${
                                    group.hasBooked
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{group.hasBooked ? 'Cannot Delete' : 'Delete All'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center relative">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-100">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Delete Row?</h3>
              <p className="text-sm text-slate-500 font-semibold">
                Are you sure you want to delete Block {deleteConfirm.blockId} Row {deleteConfirm.rowId} (all seats)? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRow}
                disabled={busy}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
