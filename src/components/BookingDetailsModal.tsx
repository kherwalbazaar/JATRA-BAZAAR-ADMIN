'use client';

import React, { useEffect, useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  QrCode, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  DoorOpen, 
  CreditCard, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { BookingItem, TicketItem } from '@/types';
import { listenTicketsByBookingId } from '@/lib/firestore';
import { formatINR } from '@/lib/utils';

interface BookingDetailsModalProps {
  booking: BookingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintBooking?: (booking: BookingItem) => void;
}

export default function BookingDetailsModal({
  booking,
  isOpen,
  onClose,
  onPrintBooking
}: BookingDetailsModalProps) {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [copiedId, setCopiedId] = useState<string>('');
  const [selectedTicketForQr, setSelectedTicketForQr] = useState<TicketItem | null>(null);

  useEffect(() => {
    if (!booking) {
      setTickets([]);
      return;
    }

    const bId = booking.ticketNumber || booking.bookingId || '';
    if (!bId) return;

    const unsub = listenTicketsByBookingId(bId, (storedList) => {
      if (storedList && storedList.length > 0) {
        setTickets(storedList);
      } else {
        // Fallback: synthesize ticket items from booking
        const count = booking.quantity || (Array.isArray(booking.seats) ? booking.seats.length : 1);
        const seats = Array.isArray(booking.seats) ? booking.seats : [];
        const usedTickets = (Array.isArray(booking.usedTickets) ? booking.usedTickets : []).map(String);
        const usedSeats = (Array.isArray(booking.usedSeats) ? booking.usedSeats : []).map(String);

        const synthetic: TicketItem[] = Array.from({ length: count }, (_, i) => {
          const ticketId = count === 1 ? bId : `${bId}-${i + 1}`;
          const seat = seats[i] || (count === 1 ? booking.seatNumber || null : null);
          const isUsed =
            usedTickets.includes(ticketId) ||
            (seat && usedSeats.includes(seat)) ||
            (count === 1 && booking.status === 'Checked-in');
          const isCancelled = booking.status === 'Cancelled' || booking.status === 'Refunded';

          return {
            id: ticketId,
            ticketId,
            bookingId: bId,
            ticketIndex: i + 1,
            totalTickets: count,
            eventId: booking.eventId,
            eventName: booking.eventName || '',
            ticketTypeId: booking.ticketTypeId,
            ticketTypeName: booking.ticketTypeName,
            seat,
            seatIndex: i + 1,
            seatCount: count,
            block: booking.block || null,
            assignedGate: booking.assignedGate,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            serialNumber: ticketId,
            qrToken: ticketId,
            status: isCancelled ? 'CANCELLED' : isUsed ? 'ENTERED' : 'ACTIVE',
            date: booking.date,
            time: booking.time,
            scannedAt: isUsed ? booking.usedAt || null : null,
            createdAt: booking.time || new Date().toISOString(),
          };
        });
        setTickets(synthetic);
      }
    });

    return () => unsub();
  }, [booking]);

  if (!isOpen || !booking) return null;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {}
  };

  const bookingId = booking.ticketNumber || booking.bookingId || '';
  const totalCount = tickets.length || booking.quantity || 1;
  const enteredCount = tickets.filter((t) => t.status === 'ENTERED').length;
  const remainingCount = Math.max(0, totalCount - enteredCount);
  const allEntered = enteredCount === totalCount && totalCount > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wide">Booking Inspector</span>
                <span className="text-[10px] bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded font-mono font-black">
                  {bookingId}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Independent Ticket Lifecycle & Gate Access Control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Booking Overview Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Customer
                </span>
                <h4 className="text-base font-black text-slate-900">{booking.customerName}</h4>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{booking.customerPhone}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Amount
                  </span>
                  <span className="text-lg font-black text-slate-900">{formatINR(booking.amount)}</span>
                  <span className="text-[10px] text-slate-500 font-bold block">{booking.paymentMethod} • {booking.source}</span>
                </div>
                {onPrintBooking && (
                  <button
                    onClick={() => onPrintBooking(booking)}
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition shadow-xs"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Metadata Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Category</span>
                <span className="font-extrabold text-slate-800">{booking.ticketTypeName}</span>
                {booking.block ? <span className="text-slate-400 text-[10px]"> • {booking.block}</span> : null}
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Gate</span>
                <span className="font-extrabold text-indigo-700">{booking.assignedGate}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Date & Time</span>
                <span className="font-extrabold text-slate-800">{booking.date}</span>
                <span className="text-[10px] text-slate-400 block">{booking.time}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Quantity</span>
                <span className="font-extrabold text-slate-900">{totalCount} {totalCount === 1 ? 'Ticket' : 'Tickets'}</span>
              </div>
            </div>

            {/* Section 20: Booking Progress */}
            <div className="bg-[#12193b] text-white rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5 text-slate-300 text-[11px] uppercase tracking-wider">
                  <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Entry Progress</span>
                </div>
                <div>
                  {allEntered ? (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✓ ALL TICKETS ENTERED ({totalCount}/{totalCount})</span>
                    </span>
                  ) : (
                    <span className="text-white font-extrabold">
                      {enteredCount} / {totalCount} ENTERED
                      <span className="text-slate-300 font-normal ml-1.5 text-[11px]">
                        • Remaining: <strong className="text-amber-300">{remainingCount}</strong>
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    allEntered ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-rose-400'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((enteredCount / Math.max(1, totalCount)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Individual Tickets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Independent Ticket Passes ({tickets.length})
              </h5>
              <span className="text-[11px] text-slate-400 font-semibold">
                Each ticket operates independently for entry
              </span>
            </div>

            <div className="space-y-2.5">
              {tickets.map((t, idx) => {
                const isEntered = t.status === 'ENTERED';
                const isCancelled = t.status === 'CANCELLED';
                const isActive = !isEntered && !isCancelled;

                return (
                  <div
                    key={t.ticketId || idx}
                    className={`rounded-2xl p-3.5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isEntered
                        ? 'bg-slate-50/90 border-slate-200'
                        : isCancelled
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-white border-slate-200/90 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      {/* Sequence Badge */}
                      <span
                        className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center flex-shrink-0 ${
                          isEntered
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {t.ticketIndex || idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-slate-900">
                            {t.ticketId}
                          </span>
                          <button
                            onClick={() => handleCopy(t.ticketId, t.ticketId)}
                            className="text-slate-400 hover:text-slate-700 text-[10px]"
                            title="Copy Ticket ID"
                          >
                            {copiedId === t.ticketId ? (
                              <Check className="w-3 h-3 text-emerald-600 inline" />
                            ) : (
                              <Copy className="w-3 h-3 inline" />
                            )}
                          </button>
                          {t.seat ? (
                            <span className="bg-slate-100 text-slate-800 font-extrabold text-[10px] px-2 py-0.5 rounded">
                              Seat {t.seat}
                            </span>
                          ) : null}
                        </div>

                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          <span>{t.ticketTypeName}</span>
                          {t.block ? <span> • Block {t.block}</span> : null}
                          <span> • {t.assignedGate}</span>
                        </div>

                        {/* Scan Audit Details */}
                        {isEntered && (
                          <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1.5 flex-wrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>
                              Admitted at {t.scanTime || (t.scannedAt ? new Date(t.scannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Gate')}
                            </span>
                            {t.scannedBy && (
                              <span className="text-slate-500">by {t.scannedBy}</span>
                            )}
                          </div>
                        )}
                        {isCancelled && (
                          <div className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>This ticket was cancelled and cannot be scanned.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge & QR Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div>
                        {isEntered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ENTERED</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>CANCELLED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedTicketForQr(t)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="View Ticket QR"
                      >
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                        <span>QR Pass</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Single Ticket QR Popup */}
      {selectedTicketForQr && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                Individual Ticket Pass
              </span>
              <button
                onClick={() => setSelectedTicketForQr(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900">{selectedTicketForQr.customerName}</h4>
              <p className="text-xs font-mono font-black text-indigo-700 mt-0.5">
                {selectedTicketForQr.ticketId}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                {selectedTicketForQr.ticketTypeName}
                {selectedTicketForQr.seat ? ` • Seat ${selectedTicketForQr.seat}` : ''}
                {` • ${selectedTicketForQr.assignedGate}`}
              </p>
            </div>

            <div className="relative inline-flex items-center justify-center p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  JSON.stringify({
                    id: selectedTicketForQr.ticketId,
                    token: selectedTicketForQr.qrToken,
                    seat: selectedTicketForQr.seat || '',
                    bookingId: selectedTicketForQr.bookingId,
                  })
                )}`}
                alt="Ticket QR"
                className={`w-48 h-48 object-contain ${
                  selectedTicketForQr.status === 'ENTERED'
                    ? 'grayscale opacity-50'
                    : selectedTicketForQr.status === 'CANCELLED'
                    ? 'grayscale opacity-30'
                    : ''
                }`}
              />
              {selectedTicketForQr.status !== 'ACTIVE' && (
                <span className="absolute inset-0 m-auto w-fit h-fit border-2 border-red-600 bg-white/95 text-red-600 font-black text-xs px-2 py-1 rounded -rotate-12 uppercase">
                  {selectedTicketForQr.status}
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-400 font-medium">
              Valid for single entry admission at gate scanner.
            </p>

            <button
              onClick={() => setSelectedTicketForQr(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
