'use client';

import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  DoorOpen, 
  User, 
  Ticket, 
  Search,
  Sparkles,
  Camera,
  Clock,
  ShieldCheck,
  Ban,
  Check,
  CheckSquare,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BookingItem, EventItem, EntryResult, TicketItem } from '@/types';
import { identifyBookingForEntry, validateAndRecordBatchEntry, validateAndRecordEntry } from '@/lib/firestore';

interface TicketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: BookingItem[];
  currentEvent?: EventItem | null;
  onCheckInTicket?: (ticketNumber: string) => void;
}

export default function TicketScannerModal({
  isOpen,
  onClose,
  bookings,
  currentEvent,
  onCheckInTicket
}: TicketScannerModalProps) {
  const [scanCode, setScanCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [scanResult, setScanResult] = useState<EntryResult | null>(null);

  // Multi-ticket selection view state
  const [identifiedBooking, setIdentifiedBooking] = useState<BookingItem | null>(null);
  const [identifiedTickets, setIdentifiedTickets] = useState<TicketItem[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [admittingTickets, setAdmittingTickets] = useState(false);

  if (!isOpen) return null;

  const handleScan = async (codeToTest?: string) => {
    const query = (codeToTest || scanCode).trim();
    if (!query) return;

    setValidating(true);
    setScanResult(null);

    try {
      const eventId = currentEvent?.id || (bookings.length > 0 ? bookings[0].eventId : '');
      const gateId = (currentEvent as any)?.assignedGate || 'Gate 1';

      const identified = await identifyBookingForEntry(query, {
        memberId: 'admin',
        gateId,
        eventId,
      });

      if (identified.status === 'FOUND' && identified.booking && identified.tickets && identified.tickets.length > 0) {
        setIdentifiedBooking(identified.booking);
        setIdentifiedTickets(identified.tickets);

        if (identified.preselectedTicketId) {
          const pre = identified.tickets.find((t) => t.ticketId === identified.preselectedTicketId);
          if (pre && pre.status === 'ACTIVE') {
            setSelectedTicketIds([identified.preselectedTicketId]);
          } else {
            setSelectedTicketIds([]);
          }
        } else {
          const activeOnly = identified.tickets.filter((t) => t.status === 'ACTIVE');
          if (activeOnly.length === 1) {
            setSelectedTicketIds([activeOnly[0].ticketId]);
          } else {
            setSelectedTicketIds([]);
          }
        }
        return;
      }

      // Rejections
      if (identified.status === 'ALREADY_USED') {
        if (identified.booking && identified.tickets) {
          setIdentifiedBooking(identified.booking);
          setIdentifiedTickets(identified.tickets);
        }
        setScanResult({
          result: 'ALREADY_USED',
          ticketId: identified.rejectedTicket?.ticketId || query,
          bookingId: identified.booking?.ticketNumber,
          audienceName: identified.booking?.customerName,
          seat: identified.rejectedTicket?.seat,
          previousEntryTime: identified.rejectedTicket?.entryTime,
          previousScannerId: identified.rejectedTicket?.scannerId,
          previousScannerName: identified.rejectedTicket?.scannerName,
          message: identified.message || 'This ticket has already been scanned.',
        });
      } else {
        setScanResult({
          result: identified.status === 'CANCELLED' ? 'CANCELLED' : identified.status === 'WRONG_EVENT' ? 'WRONG_EVENT' : 'INVALID',
          ticketId: query,
          message: identified.message || 'This ticket could not be verified.',
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanResult({
        result: 'INVALID',
        ticketId: query,
        message: 'Could not complete scan verification. Check connection.'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSelectAll = () => {
    const active = identifiedTickets.filter((t) => t.status === 'ACTIVE').map((t) => t.ticketId);
    setSelectedTicketIds(active);
  };

  const handleClearSelection = () => {
    setSelectedTicketIds([]);
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    );
  };

  const handleAdmitSelected = async () => {
    if (!selectedTicketIds.length || !identifiedBooking) return;
    setAdmittingTickets(true);
    try {
      const eventId = currentEvent?.id || (bookings.length > 0 ? bookings[0].eventId : '');
      const gateId = (currentEvent as any)?.assignedGate || 'Gate 1';

      const res = await validateAndRecordBatchEntry(
        selectedTicketIds,
        identifiedBooking.ticketNumber,
        {
          memberId: 'admin',
          gateId,
          eventId,
        }
      );

      if (res.result === 'SUCCESS') {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });

        const admittedSeats = res.admittedTickets
          .map((t) => t.seat || t.ticketId)
          .filter(Boolean)
          .join(', ');

        setScanResult({
          result: 'SUCCESS',
          ticketId: res.admittedTickets.map((t) => t.ticketId).join(', '),
          bookingId: res.bookingId,
          audienceName: res.audienceName,
          seat: admittedSeats,
          ticketType: res.ticketType,
          entryTime: res.scanTime,
          message: `${res.admittedCount} ticket${res.admittedCount > 1 ? 's' : ''} verified. Entry granted.`,
          persons: res.admittedCount,
        });

        if (onCheckInTicket && res.admittedTickets[0]?.ticketId) {
          onCheckInTicket(res.admittedTickets[0].ticketId);
        }

        // Close multi-ticket selection view
        setIdentifiedBooking(null);
        setIdentifiedTickets([]);
        setSelectedTicketIds([]);
      } else {
        setScanResult({
          result: res.result === 'ALREADY_USED' ? 'ALREADY_USED' : 'INVALID',
          ticketId: selectedTicketIds.join(', '),
          bookingId: res.bookingId,
          message: res.message || 'Admission failed.',
        });
      }
    } catch (err) {
      console.error('Batch admission error:', err);
      setScanResult({
        result: 'INVALID',
        ticketId: selectedTicketIds.join(', '),
        message: 'Could not complete admission. Check connection.'
      });
    } finally {
      setAdmittingTickets(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">
                {identifiedBooking ? 'Select Tickets for Entry' : 'Gate Scanner Terminal'}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold">
                {currentEvent?.title || 'Live Ticket Validation Engine'}
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

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {identifiedBooking ? (
            /* Multi-Ticket Selection View */
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      SELECT TICKETS FOR ENTRY
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1">
                      {identifiedBooking.customerName || 'Customer'}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {identifiedBooking.block ? `${identifiedBooking.block} • ` : ''}
                      {identifiedBooking.ticketTypeName || 'General'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">Booking ID</span>
                    <span className="text-xs font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {identifiedBooking.ticketNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={identifiedTickets.filter((t) => t.status === 'ACTIVE').length === 0}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    SELECT ALL
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={selectedTicketIds.length === 0}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-40"
                  >
                    CLEAR SELECTION
                  </button>
                </div>
                <span className="text-xs font-black text-slate-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl">
                  Selected: <span className="text-indigo-600 font-extrabold">{selectedTicketIds.length}</span>{' '}
                  {selectedTicketIds.length === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </div>

              {/* Tickets List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {identifiedTickets.map((t) => {
                  const isActive = t.status === 'ACTIVE';
                  const isSelected = selectedTicketIds.includes(t.ticketId);
                  const isEntered = t.status === 'ENTERED';
                  const isCancelled = t.status === 'CANCELLED';

                  return (
                    <div
                      key={t.ticketId}
                      onClick={() => {
                        if (isActive) toggleTicketSelection(t.ticketId);
                      }}
                      className={`p-3 rounded-xl border transition-all select-none flex items-center justify-between gap-3 ${
                        !isActive
                          ? 'bg-slate-50 opacity-60 cursor-not-allowed border-slate-200'
                          : isSelected
                          ? 'bg-indigo-50/80 border-indigo-400 shadow-2xs cursor-pointer ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isActive ? (
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 text-slate-600 text-[10px] font-black flex-shrink-0">
                            {isEntered ? '✓' : '✕'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-black text-slate-900 block truncate">
                            {t.seat || `Ticket #${t.ticketIndex || 1}`}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400 block truncate">
                            {t.ticketId}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isActive && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            ACTIVE
                          </span>
                        )}
                        {isEntered && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            ENTERED ✓
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            CANCELLED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIdentifiedBooking(null);
                    setIdentifiedTickets([]);
                    setSelectedTicketIds([]);
                  }}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdmitSelected}
                  disabled={selectedTicketIds.length === 0 || admittingTickets}
                  className="flex-1 py-3 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {admittingTickets ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Admitting...</span>
                    </>
                  ) : (
                    <span>
                      ADMIT {selectedTicketIds.length}{' '}
                      {selectedTicketIds.length === 1 ? 'TICKET' : 'TICKETS'} FOR ENTRY
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Scanner Viewfinder Box */}
              <div className="bg-slate-900 rounded-2xl p-5 relative flex flex-col items-center justify-center text-center overflow-hidden border border-indigo-900">
                {/* Viewfinder Target frame */}
                <div className="relative w-36 h-36 border-2 border-indigo-400/80 rounded-2xl flex flex-col items-center justify-center p-2 bg-indigo-950/30">
                  <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400"></div>
                  <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400"></div>
                  <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400"></div>
                  <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400"></div>

                  {/* Animated Scan Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 animate-pulse"></div>

                  <Camera className="w-8 h-8 text-indigo-300 opacity-60" />
                  <span className="text-[9px] text-indigo-200 font-bold mt-1.5">Enter / Scan Ticket ID</span>
                </div>

                {/* Quick Demo Scan Buttons from live bookings */}
                {bookings.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap justify-center max-w-sm">
                    <span className="text-[10px] text-slate-400">Recent Codes:</span>
                    {bookings.slice(0, 3).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setScanCode(b.ticketNumber);
                          handleScan(b.ticketNumber);
                        }}
                        className="text-[10px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold truncate max-w-[110px]"
                      >
                        {b.ticketNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Input Form */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                    placeholder="Scan QR or enter Ticket ID (e.g. NJ26-00001-1)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() => handleScan()}
                  disabled={validating || !scanCode.trim()}
                  className="px-4 py-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {validating ? 'Checking...' : 'Verify & Admit'}
                </button>
              </div>
            </>
          )}

          {/* Validation Result Display */}
          {scanResult && (
            <div
              className={`p-4 rounded-2xl border space-y-3 transition-all animate-in zoom-in-95 duration-150 ${
                scanResult.result === 'SUCCESS'
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : scanResult.result === 'ALREADY_USED'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-rose-50/90 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {scanResult.result === 'SUCCESS' && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  )}
                  {scanResult.result === 'ALREADY_USED' && (
                    <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
                  )}
                  {(scanResult.result === 'CANCELLED' || scanResult.result === 'WRONG_EVENT' || scanResult.result === 'INVALID') && (
                    <Ban className="w-6 h-6 text-rose-600 flex-shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide">
                      {scanResult.result === 'SUCCESS' && '✓ ATTENDEE ENTRY ALLOWED'}
                      {scanResult.result === 'ALREADY_USED' && '❌ ALREADY USED'}
                      {scanResult.result === 'CANCELLED' && '❌ CANCELLED TICKET'}
                      {scanResult.result === 'WRONG_EVENT' && '❌ WRONG EVENT'}
                      {scanResult.result === 'INVALID' && '❌ INVALID TICKET'}
                    </h4>
                    <p className="text-[11px] font-semibold opacity-80 mt-0.5">
                      {scanResult.message || (scanResult.result === 'SUCCESS' ? 'Ticket verified. Entry granted.' : 'Entry denied.')}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    scanResult.result === 'SUCCESS'
                      ? 'bg-emerald-200 text-emerald-800'
                      : scanResult.result === 'ALREADY_USED'
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-rose-200 text-rose-800'
                  }`}
                >
                  {scanResult.result === 'SUCCESS' ? 'ENTERED' : scanResult.result}
                </span>
              </div>

              {/* Ticket Details Grid */}
              <div className="bg-white/80 rounded-xl p-3 space-y-1.5 text-xs border border-slate-200/50">
                {scanResult.ticketId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket ID</span>
                    <span className="font-mono font-black text-slate-900">{scanResult.ticketId}</span>
                  </div>
                )}
                {scanResult.bookingId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Booking ID</span>
                    <span className="font-mono font-bold text-slate-600">{scanResult.bookingId}</span>
                  </div>
                )}
                {scanResult.audienceName && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Attendee</span>
                    <span className="font-extrabold text-slate-900">{scanResult.audienceName}</span>
                  </div>
                )}
                {(scanResult.seat || scanResult.ticketType) && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Seat / Tier</span>
                    <span className="font-bold text-slate-800">
                      {scanResult.block ? `${scanResult.block} • ` : ''}
                      {scanResult.seat ? `Seat ${scanResult.seat}` : scanResult.ticketType || 'General'}
                    </span>
                  </div>
                )}
                {scanResult.result === 'SUCCESS' && scanResult.entryTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Entry Time</span>
                    <span className="font-extrabold text-emerald-700">{scanResult.entryTime}</span>
                  </div>
                )}
                {scanResult.result === 'ALREADY_USED' && scanResult.previousEntryTime && (
                  <div className="bg-amber-100/70 p-2 rounded-lg space-y-0.5 mt-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-800">First Scanned:</span>
                      <span className="font-extrabold text-amber-900">{scanResult.previousEntryTime}</span>
                    </div>
                    {scanResult.previousScannerId && (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800">Scanner:</span>
                        <span className="font-semibold text-amber-900">
                          {scanResult.previousScannerId} {scanResult.previousScannerName ? `(${scanResult.previousScannerName})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {scanResult.result === 'ALREADY_USED' &&
                identifiedBooking &&
                identifiedTickets.filter((t) => t.status === 'ACTIVE').length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult(null);
                      setSelectedTicketIds([]);
                    }}
                    className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 mt-2"
                  >
                    <Ticket className="w-4 h-4" />
                    View Available Tickets in Booking ({identifiedTickets.filter((t) => t.status === 'ACTIVE').length} Active)
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
