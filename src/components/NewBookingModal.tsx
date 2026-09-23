'use client';

import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Ticket, 
  Banknote, 
  QrCode, 
  CreditCard, 
  Printer,
  CheckCircle2,
  Sparkles,
  Phone,
  User
} from 'lucide-react';
import { TicketType, BookingItem, EventItem } from '@/types';
import { generateBookingId, formatINR } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEvent: EventItem | null;
  ticketTypes: TicketType[];
  onAddBooking: (newBooking: BookingItem) => void;
  onPrintDirect: (booking: BookingItem) => void;
}

export default function NewBookingModal({
  isOpen,
  onClose,
  currentEvent,
  ticketTypes,
  onAddBooking,
  onPrintDirect
}: NewBookingModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(ticketTypes[0]?.id || 'TT-01');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');

  if (!isOpen) return null;

  const selectedTier = ticketTypes.find(t => t.id === selectedTypeId) || ticketTypes[0];
  const unitPrice = selectedTier ? selectedTier.price : 50;
  const totalAmount = unitPrice * quantity;
  const assignedGate = selectedTier?.gateAccess[0] || 'Gate C';

  const handleSubmit = (e: React.FormEvent, shouldPrint: boolean = false) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }

    const newBooking: BookingItem = {
      id: `BK-${Date.now().toString().slice(-4)}`,
      eventId: currentEvent?.id || '',
      ticketNumber: generateBookingId(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || '+91 98000 00000',
      ticketTypeId: selectedTier.id,
      ticketTypeName: selectedTier.name,
      quantity,
      unitPrice,
      amount: totalAmount,
      source: 'Counter',
      counterName: 'Booth 1 - Main Entrance',
      paymentMethod,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: currentEvent?.date ?? new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Confirmed',
      assignedGate
    };

    onAddBooking(newBooking);
    confetti({ particleCount: 40, spread: 50 });

    if (shouldPrint) {
      onPrintDirect(newBooking);
    }

    // Reset fields & close
    setCustomerName('');
    setCustomerPhone('');
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">POS Counter Ticket Booking</h3>
              <p className="text-[10px] text-slate-400 font-semibold">{currentEvent?.title ?? 'No event selected'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4">
          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                Customer Name *
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Majhi"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="e.g. 98612 34567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ticket Tier Selector */}
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1.5">
              Select Ticket Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ticketTypes.map((tier) => {
                const isSelected = selectedTypeId === tier.id;
                return (
                  <button
                    type="button"
                    key={tier.id}
                    onClick={() => setSelectedTypeId(tier.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-black ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }}></span>
                      <span className="text-xs truncate">{tier.name}</span>
                    </div>
                    <div className="text-sm font-black mt-1">₹{tier.price}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity and Gate */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                Number of Tickets
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <span className="text-base font-black text-slate-900 w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Gate:</span>
              <span className="text-xs font-black text-indigo-700">{assignedGate}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Card'] as const).map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {method === 'Cash' && <Banknote className="w-3.5 h-3.5 text-amber-400" />}
                    {method === 'UPI' && <QrCode className="w-3.5 h-3.5 text-blue-400" />}
                    {method === 'Card' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                    <span>{method}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Summary Banner */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount to Collect</span>
              <span className="text-xl font-black text-amber-400">{formatINR(totalAmount)}</span>
            </div>
            <div className="text-right text-[11px] text-slate-300 font-semibold">
              <span>{selectedTier.name} × {quantity} seats</span>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
            >
              Save Booking
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="flex-1 py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Book & Print Slip</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
