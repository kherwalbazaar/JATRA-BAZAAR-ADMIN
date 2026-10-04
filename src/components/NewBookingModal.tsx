'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Ticket,
  User,
  Phone,
  Banknote,
  QrCode,
  CreditCard,
  Printer,
  Lock,
  ChevronRight,
  Headphones,
  Minus,
  Plus,
  AlertCircle
} from 'lucide-react';
import { TicketType, BookingItem, EventItem } from '@/types';
import StageDiagram from '@/components/StageDiagram';
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

const PAYMENT_METHODS = [
  { key: 'Cash' as const, Icon: Banknote, title: 'Cash at Counter', desc: 'Pay at the ticket counter' },
  { key: 'UPI' as const, Icon: QrCode, title: 'UPI / QR', desc: 'Pay using any UPI app' },
  { key: 'Card' as const, Icon: CreditCard, title: 'Card', desc: 'Credit / Debit card at POS' }
];

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">
        {number}
      </span>
      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">{title}</h4>
    </div>
  );
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedTier = ticketTypes.find((t) => t.id === selectedTypeId) || ticketTypes[0];
  const unitPrice = selectedTier ? selectedTier.price : 50;
  const totalAmount = unitPrice * quantity;
  const assignedGate = selectedTier?.gateAccess[0] || 'Gate C';
  const tierBlocks: string[] = selectedTier?.blocks ?? [];
  const blockLabel = tierBlocks.includes('All')
    ? 'All Blocks'
    : tierBlocks.length > 0
      ? tierBlocks.join(', ')
      : '—';

  const handleSubmit = (e: React.FormEvent, shouldPrint: boolean = false) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Please enter customer name');
      return;
    }
    if (customerPhone.trim() && !/^[0-9+\-\s]{10,15}$/.test(customerPhone.trim())) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');

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
      ticketAmount: totalAmount,
      baseAmount: totalAmount,
      convenienceFee: 0,
      gstOnConvenienceFee: 0,
      platformCharge: 0,
      totalFees: 0,
      finalCustomerAmount: totalAmount,
      source: 'Counter',
      counterName: 'Booth 1 - Main Entrance',
      paymentMethod,
      time: currentEvent?.time || currentEvent?.startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: currentEvent?.date ?? new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Confirmed',
      assignedGate
    };

    onAddBooking(newBooking);
    confetti({ particleCount: 40, spread: 50 });

    if (shouldPrint) {
      onPrintDirect(newBooking);
    }

    setCustomerName('');
    setCustomerPhone('');
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[560px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96vh] text-slate-800">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Ticket className="w-4 h-4 -rotate-45" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">NEW BOOKING</h2>
              <p className="text-[11px] font-semibold text-slate-400">{currentEvent?.title ?? 'No event selected'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-4 sm:p-5 space-y-6 flex-1 overflow-y-auto">
          {/* STEP 1 — TICKET & QUANTITY */}
          <div className="space-y-3">
            <StepHeading number={1} title="Ticket & Quantity" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ticketTypes.map((tier) => {
                const isSelected = selectedTypeId === tier.id;
                return (
                  <button
                    type="button"
                    key={tier.id}
                    onClick={() => setSelectedTypeId(tier.id)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/60 text-purple-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }}></span>
                      <span className="text-xs font-black truncate">{tier.name}</span>
                    </div>
                    <div className="text-sm font-black mt-1 text-slate-900">₹{tier.price}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl border border-purple-100 bg-purple-50/50">
              <div>
                <p className="text-xs font-black text-slate-900 tracking-wide">{selectedTier?.name}</p>
                <p className="text-[10px] font-semibold text-slate-500">
                  ₹{unitPrice} per ticket &bull; {assignedGate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-black text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stage Layout Diagram */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">Stage Layout</span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                  {selectedTier?.name}: {blockLabel}
                </span>
              </div>
              <StageDiagram highlightBlocks={tierBlocks} gradientIdPrefix="nbStage" />
            </div>
          </div>

          {/* STEP 2 — YOUR DETAILS */}
          <div className="space-y-3">
            <StepHeading number={2} title="Your Details" />

            <div className="space-y-2">
              <div>
                <label htmlFor="bk-customer-name" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="bk-customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer full name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="bk-customer-phone" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="bk-customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              {error && (
                <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* STEP 3 — PAYMENT METHOD */}
          <div className="space-y-3">
            <StepHeading number={3} title="Payment Method" />

            <div className="space-y-2">
              {PAYMENT_METHODS.map((opt) => {
                const isSelected = paymentMethod === opt.key;
                return (
                  <label
                    key={opt.key}
                    onClick={() => setPaymentMethod(opt.key)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <opt.Icon className={`w-4 h-4 ${isSelected ? 'text-purple-700' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-black text-slate-900 leading-tight">{opt.title}</p>
                        <p className="text-[9px] font-medium text-slate-500">{opt.desc}</p>
                      </div>
                    </div>
                    <input type="radio" name="payment-method" checked={isSelected} readOnly className="accent-purple-600" />
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 4 — PAYMENT BREAKDOWN */}
          <div className="space-y-3">
            <StepHeading number={4} title="Payment Breakdown" />

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Ticket Amount ({quantity} ticket{quantity !== 1 ? 's' : ''})</span>
                  <span className="font-bold text-slate-900">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Convenience Fee</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>GST on Convenience Fee</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Platform Charge</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block leading-tight">Total Amount to Collect</span>
                  <span className="text-[9px] text-slate-400 font-semibold">Counter booking &bull; no extra charges</span>
                </div>
                <span className="text-base font-black text-emerald-600">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </form>

        {/* BOTTOM CTA STRIP */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 space-y-2.5">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <Printer className="w-4 h-4" />
            <span>Book & Print Slip &bull; {formatINR(totalAmount)}</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent, false)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
          >
            Save Booking
          </button>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Counter booking is 100% secure.</span>
            </div>
            <div className="flex items-center gap-1">
              <Headphones className="w-3 h-3" />
              <span>
                Need Help? <span className="text-purple-700 font-bold">Contact Support</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
