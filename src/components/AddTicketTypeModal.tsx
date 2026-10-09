'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, PlusCircle, Tag, Layers, CheckCircle, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { Seat, TicketType } from '@/types';

const BLOCK_OPTIONS = [
  'A1', 'A2', 'A3',
  'B1', 'B2', 'B3',
  'C1', 'C2', 'C3',
  'D1', 'D2', 'D3',
  'Gallery', 'Standing', 'Ground',
];

interface AddTicketTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTicketType: (newType: TicketType) => void;
  onUpdateTicketType?: (typeId: string, data: Partial<TicketType>) => void;
  editingType?: TicketType | null;
  committeeNames?: string[];
  /** Seat map used for the row dropdown counts (available/total). */
  seats?: Seat[];
  /** All ticket categories — blocks/tiers/rows already used by others are locked. */
  existingTypes?: TicketType[];
}

export default function AddTicketTypeModal({
  isOpen,
  onClose,
  onAddTicketType,
  onUpdateTicketType,
  editingType = null,
  committeeNames = [],
  seats = [],
  existingTypes = []
}: AddTicketTypeModalProps) {
  const isEdit = !!editingType;
  const [committee, setCommittee] = useState('');
  const [name, setName] = useState('');
  const [block, setBlock] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [rowOpen, setRowOpen] = useState(false);
  const [price, setPrice] = useState(100);
  const [quota, setQuota] = useState(500);
  const [color, setColor] = useState('#8b5cf6');
  const rowWrapRef = useRef<HTMLDivElement>(null);

  // Close the Row dropdown on outside click / Esc
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

  React.useEffect(() => {
    if (!isOpen) return;
    if (editingType) {
      setCommittee(editingType.committeeName || '');
      setName(editingType.name || '');
      setBlock(editingType.blocks?.[0] || '');
      setSelectedRows(editingType.rows || []);
      setPrice(editingType.price);
      setQuota(editingType.totalQuota);
      setColor(editingType.color || '#8b5cf6');
    } else {
      setCommittee('');
      setName('');
      setBlock('');
      setSelectedRows([]);
      setPrice(100);
      setQuota(500);
      setColor('#8b5cf6');
    }
  }, [isOpen, editingType]);

  if (!isOpen) return null;

  // Always show every alphabet A–Z — letters with seats show available/total,
  // letters without seats show "—".
  const rowOptions = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  // Already-used values from OTHER categories (the one being edited is exempt),
  // so a tier / block / row can only belong to a single category.
  const otherTypes = existingTypes.filter((t) => t.id !== editingType?.id);
  const takenNames = new Set(otherTypes.map((t) => t.name).filter(Boolean));
  const takenBlocks = new Set<string>();
  const takenRows = new Set<string>();
  otherTypes.forEach((t) => {
    (t.blocks || []).forEach((b) => {
      if (b && b.toUpperCase() !== 'ALL') takenBlocks.add(b.toUpperCase());
    });
    (t.rows || []).forEach((r) => {
      if (r) takenRows.add(r.toUpperCase());
    });
  });

  // available/total seats for a row letter — scoped to the selected block
  // ("All"/no block = across every block of the event).
  const statsFor = (letter: string) => {
    const scope = block.trim().toUpperCase();
    const list = seats.filter((s) => {
      const base = s.rowId.replace(/[0-9]/g, '');
      if (base !== letter) return false;
      if (scope && scope !== 'ALL' && s.blockId.toUpperCase() !== scope) return false;
      return true;
    });
    if (!list.length) return null;
    return { total: list.length, available: list.filter((s) => s.status === 'available').length };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!committee.trim()) {
      alert('Please select a committee name');
      return;
    }
    if (!name.trim()) {
      alert('Please enter tier name');
      return;
    }
    if (block && takenBlocks.has(block.toUpperCase())) {
      alert(`Block ${block} is already used by another tier — pick a different block.`);
      return;
    }
    const clash = selectedRows.filter((r) => takenRows.has(r.toUpperCase()));
    if (clash.length) {
      alert(
        `Row${clash.length > 1 ? 's' : ''} ${clash.join(', ')} already assigned to another tier — remove ${
          clash.length > 1 ? 'them' : 'it'
        } or pick other rows.`
      );
      return;
    }

    if (isEdit) {
      const confirmed = window.confirm(
        `Save changes to ticket category "${name.trim()}"?\n\nCommittee: ${committee.trim()}\nBlock: ${block || 'All'}\nRows: ${selectedRows.length ? selectedRows.join(', ') : 'All'}\nPrice: ₹${Number(price) || 0}\nTotal Quota: ${Number(quota) || 0}`
      );
      if (!confirmed) return;
    }

    if (isEdit && editingType && onUpdateTicketType) {
      onUpdateTicketType(editingType.id, {
        name: name.trim(),
        committeeName: committee.trim(),
        blocks: block ? [block] : [],
        rows: [...selectedRows],
        price: Number(price) || 100,
        totalQuota: Number(quota) || editingType.sold,
        color,
      });
      onClose();
      return;
    }

    const newType: TicketType = {
      id: `TT-${Date.now().toString().slice(-3)}`,
      name: name.trim(),
      committeeName: committee.trim(),
      blocks: block ? [block] : [],
      rows: [...selectedRows],
      price: Number(price) || 100,
      totalQuota: Number(quota) || 500,
      sold: 0,
      color,
      bgColor: 'bg-purple-500',
      textColor: 'text-purple-600',
      perks: [],
      gateAccess: []
    };

    onAddTicketType(newType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between rounded-t-3xl overflow-hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">{isEdit ? 'Edit Ticket Category' : 'Add Ticket Category'}</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Tier Pricing & Seating Setup</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs font-semibold">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Committee Name *</label>
            <select
              required
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select committee</option>
              {committeeNames.map((c) => (
                <option key={c} value={c}>🏛️ {c}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              If any committee wants to sell tickets online, fix the ticket price from here.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Tier Name *</label>
            <select
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>🎫 Select tier</option>
              {[
                { v: 'Star', l: '⭐ Star' },
                { v: 'VIP', l: '👑 VIP' },
                { v: 'Special', l: '✨ Special' },
                { v: '3rd Class', l: '🎟️ 3rd Class' },
                { v: 'Ground', l: '🌿 Ground' },
                { v: 'Standing', l: '🧍 Standing' },
              ].map(({ v, l }) => {
                const used = takenNames.has(v);
                return (
                  <option key={v} value={v} disabled={used}>
                    {l}
                    {used ? ' (already used)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Block Name dropdown */}
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Block Name *</label>
            <select
              required
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select block</option>
              <option value="All">All</option>
              {BLOCK_OPTIONS.map((b) => {
                const used = takenBlocks.has(b.toUpperCase()) && block !== b;
                return (
                  <option key={b} value={b} disabled={used}>
                    {b}
                    {used ? ' (used)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Row selection — dropdown with A–Z grid + available/total counts */}
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
              Select Row {selectedRows.length > 0 && `(${selectedRows.length} selected)`}
            </label>
            <div ref={rowWrapRef} className="relative">
              <button
                type="button"
                onClick={() => setRowOpen((o) => !o)}
                className={`w-full px-3 py-2 border rounded-xl text-xs font-bold outline-none text-left flex items-center justify-between gap-2 transition-colors ${
                  selectedRows.length
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                } ${rowOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : ''}`}
              >
                <span className="truncate">
                  {selectedRows.length ? selectedRows.join(', ') : 'All Rows'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${rowOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {rowOpen && (
                <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-300/60 p-2">
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Rows {block && block !== 'All' ? `· Block ${block}` : '· All blocks'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedRows([])}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-800"
                    >
                      Reset to All Rows
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-0.5">
                    <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {rowOptions.map((letter) => {
                        const stats = statsFor(letter);
                        const on = selectedRows.includes(letter);
                        const taken = takenRows.has(letter) && !on;
                        return (
                          <button
                            key={letter}
                            type="button"
                            disabled={taken}
                            title={
                              taken
                                ? `Row ${letter} already assigned to another tier`
                                : stats
                                  ? `Row ${letter}: ${stats.available}/${stats.total} seats`
                                  : `Row ${letter}: no seats yet`
                            }
                            onClick={() => {
                              if (taken) return;
                              setSelectedRows((prev) =>
                                on ? prev.filter((r) => r !== letter) : [...prev, letter]
                              );
                            }}
                            className={`relative rounded-lg text-[11px] font-black border-2 overflow-hidden transition-all ${
                              on
                                ? 'bg-[#4f39f6] text-white border-[#4f39f6] shadow-[0_4px_10px_-2px_rgba(79,57,246,0.55)]'
                                : taken
                                  ? 'bg-red-100 text-red-400 border-red-400 cursor-not-allowed shadow-[0_3px_6px_-1px_rgba(15,23,42,0.22)]'
                                  : 'bg-white text-slate-700 border-emerald-400 hover:border-emerald-500 active:scale-95 shadow-[0_3px_6px_-1px_rgba(15,23,42,0.22)]'
                            }`}
                          >
                            {on && <Check className="w-2.5 h-2.5 absolute top-0.5 right-0.5" />}
                            <span className={`block leading-none pt-1.5 px-1 ${taken ? 'line-through' : ''}`}>
                              {letter}
                            </span>
                            <span
                              className={`block text-[8px] font-bold px-1 py-0.5 mt-1 ${
                                on
                                  ? 'bg-indigo-500 text-white'
                                  : taken
                                    ? 'bg-red-200 text-red-500'
                                    : 'bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              {taken ? 'Used' : stats ? `${stats.available}/${stats.total}` : '—'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              Click letters to pick rows — e.g. Star = A, VIP = B, Special = C. Rows/blocks/tiers already
              assigned to another category show red as “Used” and can’t be picked. “All Rows” (nothing
              picked) covers every row.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Price per Seat (₹) *</label>
              <div className="flex items-stretch">
                <input
                  type="number"
                  required
                  min={0}
                  step={10}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-l-xl text-xs font-bold text-slate-800 outline-none"
                />
                <div className="flex flex-col border border-l-0 border-slate-200 rounded-r-xl overflow-hidden flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPrice((p) => (Number.isFinite(p) ? p : 0) + 10);
                    }}
                    className="w-7 px-1 py-1 bg-slate-100 hover:bg-indigo-100 active:bg-indigo-200 text-slate-600 hover:text-indigo-700 flex items-center justify-center transition-colors"
                    aria-label="Increase price by 10"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPrice((p) => Math.max(0, (Number.isFinite(p) ? p : 0) - 10));
                    }}
                    className="w-7 px-1 py-1 bg-slate-100 hover:bg-indigo-100 active:bg-indigo-200 text-slate-600 hover:text-indigo-700 flex items-center justify-center border-t border-slate-200 transition-colors"
                    aria-label="Decrease price by 10"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95"
            >
              {isEdit ? 'Save Changes' : 'Add Ticket Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
