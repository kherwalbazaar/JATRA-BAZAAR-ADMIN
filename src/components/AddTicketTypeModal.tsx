'use client';

import React, { useState } from 'react';
import { X, PlusCircle, Tag, Layers, CheckCircle } from 'lucide-react';
import { TicketType } from '@/types';

interface AddTicketTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTicketType: (newType: TicketType) => void;
}

export default function AddTicketTypeModal({
  isOpen,
  onClose,
  onAddTicketType
}: AddTicketTypeModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(150);
  const [quota, setQuota] = useState(500);
  const [color, setColor] = useState('#8b5cf6');
  const [badgeText, setBadgeText] = useState('Special Tier');
  const [perksText, setPerksText] = useState('Front View Chairs, Dedicated Snack Bar');
  const [gate, setGate] = useState('Gate B');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter tier name');
      return;
    }

    const newType: TicketType = {
      id: `TT-${Date.now().toString().slice(-3)}`,
      name: name.trim(),
      badgeText,
      price: Number(price) || 100,
      totalQuota: Number(quota) || 500,
      sold: 0,
      color,
      bgColor: 'bg-purple-500',
      textColor: 'text-purple-600',
      perks: perksText.split(',').map(s => s.trim()).filter(Boolean),
      gateAccess: [gate]
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
              <h3 className="text-sm font-black tracking-wide">Add Ticket Category</h3>
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
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Tier Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Balcony VIP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Price per Seat (₹) *</label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Badge Subtext</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Gate Entry</label>
              <select
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                <option value="Gate A">Gate A (VIP)</option>
                <option value="Gate B">Gate B (Premium)</option>
                <option value="Gate C">Gate C (General East)</option>
                <option value="Gate D">Gate D (General West)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Included Perks (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Cushioned Seats, Tea Token, Program Booklet"
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95"
            >
              Add Ticket Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
