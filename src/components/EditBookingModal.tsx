'use client';

import React, { useEffect, useState } from 'react';
import { X, Save, AlertCircle, Loader2, Lock, User, Phone, Mail, DoorOpen, CreditCard, Hash } from 'lucide-react';
import { BookingItem, PaymentMethod } from '@/types';
import { updateBooking } from '@/lib/firestore';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Other'];

interface EditBookingModalProps {
  booking: BookingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (booking: BookingItem, patch: Partial<BookingItem>) => void;
}

export default function EditBookingModal({ booking, isOpen, onClose, onSaved }: EditBookingModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [assignedGate, setAssignedGate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booking) return;
    setCustomerName(booking.customerName || '');
    setCustomerPhone(booking.customerPhone || '');
    setCustomerEmail(booking.customerEmail || '');
    setAssignedGate(booking.assignedGate || '');
    setPaymentMethod((booking.paymentMethod as PaymentMethod) || 'Cash');
    setTransactionId(booking.transactionId || '');
    setError('');
    setSaving(false);
  }, [booking]);

  if (!isOpen || !booking) return null;

  const isLocked = booking.status === 'Cancelled' || booking.status === 'Refunded';

  const handleSave = async () => {
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const patch: Partial<BookingItem> = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || undefined,
      assignedGate: assignedGate.trim(),
      paymentMethod,
      transactionId: transactionId.trim() || undefined,
    };
    try {
      setSaving(true);
      setError('');
      await updateBooking(booking.id, patch);
      onSaved?.(booking, patch);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to update booking. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl">
          <div>
            <h3 className="text-base font-black text-slate-900">Edit Booking</h3>
            <p className="text-[11px] text-slate-400 font-semibold">
              {booking.ticketNumber} • {booking.ticketTypeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase text-indigo-400">Ticket / Seats / Amount</div>
              <div className="text-xs font-bold text-indigo-900 truncate">
                {booking.quantity} × {booking.ticketTypeName}
                {booking.block ? ` • Block ${booking.block}` : ''}
                {booking.seats && booking.seats.length > 0 ? ` • ${booking.seats.slice(0, 4).join(', ')}${booking.seats.length > 4 ? ` +${booking.seats.length - 4}` : ''}` : ''} • ₹{booking.amount}
              </div>
            </div>
            <Lock className="w-4 h-4 text-indigo-300 flex-shrink-0" />
          </div>
          <p className="text-[10px] text-slate-400 font-semibold -mt-2">
            Seats, quantity and amount are fixed to keep inventory & reports accurate. Use Cancel (in details) to release seats instead.
          </p>

          {isLocked && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-semibold text-amber-800">
                This booking is {booking.status.toLowerCase()} — editing is disabled to keep audit history intact.
              </p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
              <User className="w-3.5 h-3.5" /> Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputCls}
              placeholder="Full name"
              disabled={saving || isLocked}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className={inputCls}
                placeholder="10-digit mobile"
                disabled={saving || isLocked}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className={inputCls}
                placeholder="Optional"
                disabled={saving || isLocked}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
                <DoorOpen className="w-3.5 h-3.5" /> Gate
              </label>
              <input
                type="text"
                value={assignedGate}
                onChange={(e) => setAssignedGate(e.target.value)}
                className={inputCls}
                placeholder="e.g. Gate 1"
                disabled={saving || isLocked}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={inputCls}
                disabled={saving || isLocked}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase mb-1.5">
              <Hash className="w-3.5 h-3.5" /> Transaction / UPI Reference
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className={inputCls}
              placeholder="Optional — UPI / bank reference"
              disabled={saving || isLocked}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-semibold text-rose-700">{error}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLocked || !customerName.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
