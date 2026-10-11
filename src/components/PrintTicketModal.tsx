'use client';

import React from 'react';
import { X, Printer, MessageCircle } from 'lucide-react';
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

  const handleWhatsAppShare = () => {
    const digits = booking.customerPhone.replace(/\D/g, '');
    const waPhone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : '';
    const seatLine = booking.seats?.length
      ? `Seats: ${booking.block ? `${booking.block}: ` : ''}${booking.seats.join(', ')}\n`
      : '';
    const lines = [
      `*${currentEvent?.title ?? 'Event'}* - Ticket Confirmed!`,
      `Booking ID: ${booking.ticketNumber}`,
      `Name: ${booking.customerName}`,
      `Class: ${booking.ticketTypeName} | Qty: ${booking.quantity}`,
      seatLine.trimEnd(),
      `Amount: ${formatINR(booking.amount)} (${booking.paymentMethod})`,
      `Gate: ${booking.assignedGate}`,
      `${currentEvent?.date ?? ''}${currentEvent?.time ? ` | ${currentEvent.time}` : ''}`
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join('\n'));
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
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
      <div className="bg-white rounded-2xl max-w-xs w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-2.5 bg-[#0f1430] text-white flex items-center justify-between">
          <span className="text-[11px] font-black tracking-wide">Print Preview</span>
          <button 
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Printable Ticket */}
        <div className="p-4 bg-slate-100 flex justify-center">
          <div 
            id="printable-ticket" 
            className="bg-white border border-slate-200 p-3.5 w-[280px] shadow-sm text-slate-800 space-y-2 font-mono text-[10px] leading-tight"
          >
            {/* Event */}
            <div className="text-center border-b border-dashed border-slate-300 pb-2">
              <div className="font-sans font-black text-slate-900 text-xs leading-tight">
                {currentEvent?.title ?? 'Event'}
              </div>
              <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                {currentEvent?.date ?? ''} • {currentEvent?.time ?? ''}
              </div>
            </div>

            {/* Core info */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket ID</span>
                <span className="font-bold text-indigo-700">{booking.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-bold text-slate-900">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class</span>
                <span className="font-bold text-slate-900">{booking.ticketTypeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Qty</span>
                <span className="font-bold text-slate-900">{booking.quantity}</span>
              </div>
              {booking.seats && booking.seats.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Seats</span>
                  <span className="font-bold text-slate-900">
                    {booking.block ? `${booking.block}: ` : ''}{booking.seats.join(', ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Gate</span>
                <span className="font-bold text-emerald-700">{booking.assignedGate}</span>
              </div>
              <div className="flex justify-between border-t border-dotted border-slate-200 pt-1 mt-1">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-900">₹{booking.amount}</span>
              </div>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center pt-1 border-t border-dashed border-slate-300">
              <img 
                src={qrImageUrl} 
                alt="QR" 
                className="w-20 h-20 border border-slate-200 bg-white"
              />
              <span className="text-[8px] font-sans text-slate-400 mt-1">Scan at gate</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 py-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[11px] font-black rounded-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-[11px] font-black rounded-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
