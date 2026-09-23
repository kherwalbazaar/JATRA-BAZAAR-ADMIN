'use client';

import React from 'react';
import { 
  Store, 
  UserCheck, 
  Banknote, 
  QrCode, 
  Coins, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight,
  Printer
} from 'lucide-react';
import { CounterBooth, EventItem } from '@/types';
import { formatINR, formatNumber } from '@/lib/utils';

interface CounterManagementViewProps {
  currentEvent: EventItem | null;
  counters: CounterBooth[];
  onOpenNewBooking: () => void;
}

export default function CounterManagementView({
  currentEvent,
  counters,
  onOpenNewBooking
}: CounterManagementViewProps) {
  const totalCounterSales = counters.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalCashCollected = counters.reduce((sum, c) => sum + c.cashAmount, 0);
  const totalUpiCollected = counters.reduce((sum, c) => sum + c.upiAmount, 0);
  const totalTicketsIssued = counters.reduce((sum, c) => sum + c.ticketsSold, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Counter POS & Box Office Terminals</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {counters.length} Booths Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Real-time physical counter tracking, cash reconciliation, and operator shift summaries.
          </p>
        </div>

        <button
          onClick={onOpenNewBooking}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Launch POS Counter Sale</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Counter Sales</span>
          <h3 className="text-xl font-black text-slate-900 mt-0.5">{formatINR(totalCounterSales)}</h3>
          <span className="text-[10px] text-slate-400 font-semibold">{totalTicketsIssued} Tickets Issued</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Cash in Hand / Drawer</span>
          <h3 className="text-xl font-black text-amber-600 mt-0.5">{formatINR(totalCashCollected)}</h3>
          <span className="text-[10px] text-slate-400 font-semibold">Physical Notes to Vault</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">UPI at Counter</span>
          <h3 className="text-xl font-black text-blue-600 mt-0.5">{formatINR(totalUpiCollected)}</h3>
          <span className="text-[10px] text-slate-400 font-semibold">Direct Bank Settlement</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Printer Terminal Status</span>
          <h3 className="text-sm font-black text-emerald-600 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Thermal POS Online
          </h3>
          <span className="text-[10px] text-slate-400 font-semibold">ESC/POS 80mm & 58mm</span>
        </div>
      </div>

      {/* Counter Booths Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {counters.map((booth) => (
          <div key={booth.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg font-black">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">{booth.name}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-indigo-600" />
                    <span>Op: {booth.operatorName}</span>
                  </p>
                </div>
              </div>

              <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl text-xs font-semibold text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tickets Issued:</span>
                <span className="font-black text-slate-900">{booth.ticketsSold}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cash Collected:</span>
                <span className="font-black text-amber-600">₹{booth.cashAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">UPI Collected:</span>
                <span className="font-black text-blue-600">₹{booth.upiAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-bold">
                <span className="text-slate-900 font-black">Total Booth Turn:</span>
                <span className="text-indigo-600 font-black">₹{booth.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Last Transaction: {booth.lastActive}</span>
              <button 
                onClick={onOpenNewBooking}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Sell Tickets →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
