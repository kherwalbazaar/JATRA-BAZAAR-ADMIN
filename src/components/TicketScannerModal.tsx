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
  Camera
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BookingItem } from '@/types';

interface TicketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: BookingItem[];
  onCheckInTicket: (ticketNumber: string) => void;
}

export default function TicketScannerModal({
  isOpen,
  onClose,
  bookings,
  onCheckInTicket
}: TicketScannerModalProps) {
  const [scanCode, setScanCode] = useState('');
  const [scannedResult, setScannedResult] = useState<BookingItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScan = (codeToTest?: string) => {
    const query = (codeToTest || scanCode).trim().toUpperCase();
    if (!query) return;

    const found = bookings.find(
      b => b.ticketNumber.toUpperCase() === query || b.id.toUpperCase() === query
    );

    if (found) {
      setScannedResult(found);
      setScanError(null);
      if (found.status !== 'Checked-in') {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      }
    } else {
      setScannedResult(null);
      setScanError(`Ticket "${query}" not found in current event database.`);
    }
  };

  const handleConfirmCheckIn = () => {
    if (scannedResult) {
      onCheckInTicket(scannedResult.ticketNumber);
      setScannedResult({ ...scannedResult, status: 'Checked-in' });
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
              <h3 className="text-sm font-black tracking-wide">Gate Scanner Terminal</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Live Ticket Validation Engine</p>
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
        <div className="p-6 space-y-5">
          {/* Scanner Viewfinder Box */}
          <div className="bg-slate-900 rounded-2xl p-6 relative flex flex-col items-center justify-center text-center overflow-hidden border border-indigo-900">
            {/* Viewfinder Target frame */}
            <div className="relative w-44 h-44 border-2 border-indigo-400/80 rounded-2xl flex flex-col items-center justify-center p-2 bg-indigo-950/30">
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400"></div>
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400"></div>
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400"></div>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400"></div>

              {/* Animated Scan Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 animate-pulse"></div>

              <Camera className="w-10 h-10 text-indigo-300 opacity-60" />
              <span className="text-[10px] text-indigo-200 font-bold mt-2">Ready to Scan QR / Barcode</span>
            </div>

            {/* Quick Demo Scan Buttons */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap justify-center">
              <span className="text-[10px] text-slate-400">Test Codes:</span>
              <button
                onClick={() => {
                  setScanCode('JB26-00325');
                  handleScan('JB26-00325');
                }}
                className="text-[10px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold"
              >
                JB26-00325 (VIP)
              </button>
              <button
                onClick={() => {
                  setScanCode('JB26-00323');
                  handleScan('JB26-00323');
                }}
                className="text-[10px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold"
              >
                JB26-00323 (General)
              </button>
            </div>
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
                placeholder="Or enter Ticket Code (e.g. JB26-00325)"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <button
              onClick={() => handleScan()}
              className="px-4 py-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-bold rounded-xl transition-colors"
            >
              Verify
            </button>
          </div>

          {/* Validation Result Display */}
          {scannedResult && (
            <div className={`p-4 rounded-2xl border ${
              scannedResult.status === 'Checked-in' 
                ? 'bg-blue-50/80 border-blue-200' 
                : 'bg-emerald-50/80 border-emerald-200'
            } space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-5 h-5 ${
                    scannedResult.status === 'Checked-in' ? 'text-blue-600' : 'text-emerald-600'
                  }`} />
                  <div>
                    <span className="text-xs font-black text-slate-900">{scannedResult.customerName}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">{scannedResult.ticketNumber}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                  scannedResult.status === 'Checked-in'
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {scannedResult.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-white/70 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Category & Seats</span>
                  <span className="text-slate-900">{scannedResult.ticketTypeName} × {scannedResult.quantity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Assigned Entrance</span>
                  <span className="text-indigo-600 font-extrabold flex items-center gap-1">
                    <DoorOpen className="w-3.5 h-3.5" />
                    {scannedResult.assignedGate}
                  </span>
                </div>
              </div>

              {scannedResult.status !== 'Checked-in' ? (
                <button
                  onClick={handleConfirmCheckIn}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-colors"
                >
                  Confirm Gate Admission & Admit
                </button>
              ) : (
                <div className="text-center text-[11px] font-bold text-blue-700">
                  Already Admitted at Gate
                </div>
              )}
            </div>
          )}

          {scanError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{scanError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
