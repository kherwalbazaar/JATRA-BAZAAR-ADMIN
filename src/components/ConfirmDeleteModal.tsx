'use client';

import React from 'react';
import { X, Trash2, AlertTriangle, Ticket } from 'lucide-react';
import { BookingItem } from '@/types';

interface ConfirmDeleteModalProps {
  booking: BookingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({ booking, isOpen, onClose, onConfirm }: ConfirmDeleteModalProps) {
  if (!isOpen || !booking) return null;

  const seatSummary = booking.seats?.length
    ? `${booking.block ? booking.block + ': ' : ''}${booking.seats.join(', ')}`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Colorful gradient header */}
        <div className="relative bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 px-6 pt-6 pb-8 text-center">
          {/* Decorative circles */}
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-14 -right-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Animated trash icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-3 shadow-lg">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>

          <h3 className="text-lg font-black text-white">Delete Ticket?</h3>
          <p className="text-xs text-white/80 font-semibold mt-1">
            This action cannot be undone
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Ticket info card */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-200">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-800 truncate">{booking.customerName}</p>
              <p className="text-[11px] font-bold text-indigo-600 font-mono">{booking.ticketNumber}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Amount</p>
              <p className="text-sm font-black text-slate-800">₹{booking.amount}</p>
            </div>
          </div>

          {/* What will happen */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
              Ticket document removed from database
            </div>
            {seatSummary && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                Seats <span className="font-mono font-bold text-slate-800">{seatSummary}</span> released
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              Seats become available for resale
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-2xl transition-colors"
          >
            Keep Ticket
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-rose-300/50 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
