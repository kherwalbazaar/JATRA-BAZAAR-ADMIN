'use client';

import React from 'react';
import { 
  TrendingUp, 
  Download, 
  FileSpreadsheet, 
  DollarSign, 
  CreditCard, 
  Users, 
  Ticket, 
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { KPIStats, TicketType, EventItem } from '@/types';
import { formatINR, formatNumber } from '@/lib/utils';

interface ReportsViewProps {
  currentEvent: EventItem | null;
  kpis: KPIStats;
  ticketTypes: TicketType[];
}

export default function ReportsView({
  currentEvent,
  kpis,
  ticketTypes
}: ReportsViewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Executive Financial & Attendance Reports</span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Audit-ready sales ledgers, gate pacing analysis, and channel breakdowns for <span className="text-slate-700 font-bold">{currentEvent?.title ?? 'all events'}</span>.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting full financial audit PDF and CSV...')}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Download Consolidated PDF</span>
        </button>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Channel Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Channel Distribution</h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-600">Online Portals (UPI/Card)</span>
                <span className="text-slate-900">{formatINR(kpis.onlineCollection)} (68.4%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '68.4%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-600">Physical Counter POS</span>
                <span className="text-slate-900">{formatINR(kpis.offlineCollection)} (31.6%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '31.6%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Payment Instruments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Payment Instruments</h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-600">UPI / QR Code Scan</span>
                <span className="text-blue-600">{formatINR(kpis.upiCollection)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '78.9%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-600">Cash Payments</span>
                <span className="text-amber-600">{formatINR(kpis.cashCollection)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '21.1%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Gate Real-time Attendance Ratio */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Venue Entry Conversion</h3>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tickets Issued:</span>
              <span className="font-bold text-slate-900">{formatNumber(kpis.totalTicketsSold)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Admitted At Gate:</span>
              <span className="font-bold text-emerald-600">{formatNumber(kpis.peopleEntered)}</span>
            </div>
            <div className="flex justify-between py-1 font-bold">
              <span className="text-slate-500">Yet to Arrive:</span>
              <span className="text-indigo-600">{kpis.totalTicketsSold - kpis.peopleEntered} attendees</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Tier Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Revenue Breakdown by Ticket Category</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">Total Quota</th>
                <th className="py-2.5 px-3">Sold Units</th>
                <th className="py-2.5 px-3">Occupancy</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {ticketTypes.map((t) => {
                const occupancy = Math.round((t.sold / t.totalQuota) * 100);
                const revenue = t.sold * t.price;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }}></span>
                      <span>{t.name}</span>
                    </td>
                    <td className="py-2.5 px-3">₹{t.price}</td>
                    <td className="py-2.5 px-3">{formatNumber(t.totalQuota)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{formatNumber(t.sold)}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-600">{occupancy}%</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">{formatINR(revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
