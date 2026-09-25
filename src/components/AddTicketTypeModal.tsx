'use client';

import React, { useState } from 'react';
import { X, PlusCircle, Tag, Layers, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { TicketType } from '@/types';

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
}

export default function AddTicketTypeModal({
  isOpen,
  onClose,
  onAddTicketType,
  onUpdateTicketType,
  editingType = null,
  committeeNames = []
}: AddTicketTypeModalProps) {
  const isEdit = !!editingType;
  const [committee, setCommittee] = useState('');
  const [name, setName] = useState('');
  const [block, setBlock] = useState('');
  const [price, setPrice] = useState(100);
  const [quota, setQuota] = useState(500);
  const [color, setColor] = useState('#8b5cf6');

  React.useEffect(() => {
    if (!isOpen) return;
    if (editingType) {
      setCommittee(editingType.committeeName || '');
      setName(editingType.name || '');
      setBlock(editingType.blocks?.[0] || '');
      setPrice(editingType.price);
      setQuota(editingType.totalQuota);
      setColor(editingType.color || '#8b5cf6');
    } else {
      setCommittee('');
      setName('');
      setBlock('');
      setPrice(100);
      setQuota(500);
      setColor('#8b5cf6');
    }
  }, [isOpen, editingType]);

  if (!isOpen) return null;

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

    if (isEdit && editingType && onUpdateTicketType) {
      onUpdateTicketType(editingType.id, {
        name: name.trim(),
        committeeName: committee.trim(),
        blocks: block ? [block] : [],
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
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between">
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
              <option value="Star">⭐ Star</option>
              <option value="VIP">👑 VIP</option>
              <option value="Special">✨ Special</option>
              <option value="3rd Class">🎟️ 3rd Class</option>
              <option value="Ground">🌿 Ground</option>
              <option value="Standing">🧍 Standing</option>
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
              {BLOCK_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Total Quota (Seats) *</label>
              <input
                type="number"
                required
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
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
