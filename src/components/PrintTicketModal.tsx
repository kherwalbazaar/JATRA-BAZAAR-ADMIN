'use client';

import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  DoorOpen, 
  Calendar, 
  MapPin, 
  Clock, 
  Ticket, 
  Sparkles 
} from 'lucide-react';
import { BookingItem, EventItem } from '@/types';
import { formatINR } from '@/lib/utils';

interface PrintTicketModalProps {
  booking: BookingItem | null;
  currentEvent: EventItem | null;
  onClose: () => void;
}

export default function PrintTicketModal({
  booking,
  currentEvent,
  onClose
}: PrintTicketModalProps) {
  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    JSON.stringify({
      id: booking.ticketNumber,
      holder: booking.customerName,
      tier: booking.ticketTypeName,
      qty: booking.quantity,
      gate: booking.assignedGate
    })
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black tracking-wide">Ticket Receipt Preview</span>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ticket Body / Printable Section */}
        <div className="p-6 bg-slate-100 flex justify-center">
          <div 
            id="printable-ticket" 
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-sm shadow-md text-slate-800 space-y-4 font-mono relative overflow-hidden"
          >
            {/* Top Cutout Dots */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="flex items-center justify-center gap-1 text-sm font-black tracking-wider text-slate-900">
                <span>🎭</span>
                <span>                JATRA BAZAAR 2026</span>
              </div>
              <p className="text-[10px] text-slate-500 font-sans font-bold uppercase mt-0.5">
                Official Admission Pass
              </p>
            </div>

            {/* Event Details */}
            <div className="space-y-1 text-xs">
              <div className="font-sans font-black text-slate-900 text-sm leading-tight">
                {currentEvent?.title ?? 'Event'}
              </div>
              <p className="text-[10px] text-slate-600 font-sans flex items-center gap-1">
                <Calendar className="w-3 h-3 text-rose-500" />
                <span>{currentEvent?.date ?? ''} ({currentEvent?.day ?? ''}) • {currentEvent?.time ?? ''}</span>
              </p>
              <p className="text-[10px] text-slate-600 font-sans flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-500" />
                <span>{currentEvent?.venue ?? ''}</span>
              </p>
            </div>

            {/* Ticket Tier Banner */}
            <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between font-sans">
              <div>
                <span className="text-[9px] uppercase font-bold text-amber-400 block">Class</span>
                <span className="text-sm font-black">{booking.ticketTypeName}</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Qty</span>
                <span className="text-sm font-black">{booking.quantity}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Gate</span>
                <span className="text-sm font-black text-emerald-400">{booking.assignedGate}</span>
              </div>
            </div>

            {/* Customer & Amount */}
            <div className="border-t border-b border-dashed border-slate-300 py-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Booking ID:</span>
                <span className="font-bold text-indigo-700">{booking.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Attendee:</span>
                <span className="font-bold text-slate-900">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact:</span>
                <span className="text-slate-700">{booking.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="font-bold text-slate-900">{booking.paymentMethod} • ₹{booking.amount}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center pt-1">
              <img 
                src={qrImageUrl} 
                alt="Ticket QR Code" 
                className="w-28 h-28 border border-slate-200 rounded-lg p-1 bg-white"
              />
              <span className="text-[9px] font-mono text-slate-400 mt-1.5 tracking-wider">
                Scan at {booking.assignedGate} turnstile
              </span>
            </div>

            <div className="text-center text-[8px] text-slate-400 font-sans border-t border-slate-100 pt-2">
              Valid only for 1 entry • Non-refundable • Keep barcode dry
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Thermal Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
