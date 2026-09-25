'use client';

import React, { useEffect, useRef } from 'react';
import { 
  Ticket, 
  CircleDollarSign, 
  Coins, 
  Users, 
  TrendingUp, 
  ArrowUpRight, 
  Globe, 
  Store, 
  Banknote, 
  QrCode, 
  BarChart3, 
  DoorOpen, 
  CalendarPlus, 
  PlusCircle, 
  UserPlus, 
  ListChecks, 
  FileSpreadsheet, 
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { EventItem, TicketType, BookingItem, GateInfo, KPIStats, NavigationTab } from '@/types';
import { formatINR, formatNumber } from '@/lib/utils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardViewProps {
  currentEvent: EventItem | null;
  kpis: KPIStats;
  ticketTypes: TicketType[];
  gates: GateInfo[];
  recentBookings: BookingItem[];
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenCreateEvent: () => void;
  onOpenAddTicketType: () => void;
  onOpenNewBooking: () => void;
  onOpenScanner: () => void;
  onSelectBooking: (booking: BookingItem) => void;
}

export default function DashboardView({
  currentEvent,
  kpis,
  ticketTypes,
  gates,
  recentBookings,
  onNavigateTab,
  onOpenCreateEvent,
  onOpenAddTicketType,
  onOpenNewBooking,
  onOpenScanner,
  onSelectBooking
}: DashboardViewProps) {

  // 1. Line Chart Data & Config (Tickets Sold & Collection)
  const lineChartData = {
    labels: [],
    datasets: [
      {
        label: 'Tickets Sold',
        data: [],
        borderColor: '#6342ff',
        backgroundColor: 'rgba(99, 66, 255, 0.08)',
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#6342ff',
        yAxisID: 'y',
        fill: true,
      },
      {
        label: 'Collection (₹)',
        data: [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.04)',
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#22c55e',
        yAxisID: 'y1',
        fill: true,
      }
    ]
  };

  const lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1430',
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 11 },
        callbacks: {
          label: function(context: any) {
            if (context.dataset.yAxisID === 'y1') {
              return `Collection: ₹${context.raw}K`;
            }
            return `Tickets Sold: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, weight: 'bold' }, color: '#94a3b8' }
      },
      y: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 1000,
        ticks: { stepSize: 200, font: { size: 9 }, color: '#94a3b8' },
        grid: { color: '#f1f5f9' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 800,
        ticks: {
          stepSize: 200,
          callback: (value: any) => `₹${value}K`,
          font: { size: 9 },
          color: '#94a3b8'
        },
        grid: { drawOnChartArea: false }
      }
    }
  };

  // 2. Ticket Types Donut
  const donutTypeData = {
    labels: ticketTypes.map(t => t.name),
    datasets: [{
      data: ticketTypes.map(t => t.sold),
      backgroundColor: ticketTypes.map(t => t.color),
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const donutTypeOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1430',
        padding: 10,
        cornerRadius: 8
      }
    }
  };

  // 3. Booking Source Donut
  const onlineCount = recentBookings.filter(b => b.source === 'Online').reduce((s, b) => s + b.quantity, 0);
  const offlineCount = recentBookings.filter(b => b.source === 'Counter').reduce((s, b) => s + b.quantity, 0);
  const donutSourceData = {
    labels: ['Online', 'Offline (Counter)'],
    datasets: [{
      data: [onlineCount, offlineCount],
      backgroundColor: ['#6342ff', '#22c55e'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const donutSourceOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1430',
        padding: 10,
        cornerRadius: 8
      }
    }
  };

  return (
    <main className="p-6 space-y-5 bg-white min-h-full">
      
      {/* =========================================================
           1. TOP 5 KEY KPI STATS CARDS
           ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* KPI 1: TOTAL TICKETS SOLD */}
        <div className="bg-[#eef1f8] rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-2.5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-[#6342ff] text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Ticket className="w-[18px] h-[18px] -rotate-12" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Tickets Sold</span>
            <h3 className="text-base font-black text-slate-900 leading-tight">{formatNumber(kpis.totalTicketsSold)}</h3>
          </div>
        </div>

        {/* KPI 2: TOTAL COLLECTION */}
        <div className="bg-[#eef1f8] rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-2.5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-[#16a34a] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
            <Coins className="w-[18px] h-[18px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Collection</span>
            <h3 className="text-base font-black text-slate-900 leading-tight">{formatINR(kpis.totalCollection)}</h3>
          </div>
        </div>

        {/* KPI 3: TICKETS REMAINING */}
        <div className="bg-[#eef1f8] rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-2.5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
            <Ticket className="w-[18px] h-[18px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tickets Remaining</span>
            <h3 className="text-base font-black text-slate-900 leading-tight">{formatNumber(kpis.ticketsRemaining)}</h3>
          </div>
        </div>

        {/* KPI 4: PEOPLE ENTERED */}
        <div className="bg-[#eef1f8] rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-2.5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-[#ea580c] text-white flex items-center justify-center shadow-md shadow-orange-500/20 flex-shrink-0">
            <Users className="w-[18px] h-[18px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">People Entered</span>
            <h3 className="text-base font-black text-slate-900 leading-tight">{formatNumber(kpis.peopleEntered)}</h3>
          </div>
        </div>

        {/* KPI 5: TODAY'S COLLECTION */}
        <div className="bg-[#eef1f8] rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-2.5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-[#db2777] text-white flex items-center justify-center shadow-md shadow-pink-500/20 flex-shrink-0">
            <BarChart3 className="w-[18px] h-[18px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Today's Collection</span>
            <h3 className="text-base font-black text-slate-900 leading-tight">{formatINR(kpis.todayCollection)}</h3>
          </div>
        </div>

      </div>


      {/* =========================================================
           2. MIDDLE ROW: CHARTS & SALES SUMMARY (3 COLUMNS)
           ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Ticket Sales Overview Chart (5 cols) */}
        <div className="lg:col-span-5 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ticket Sales Overview</h3>
            <button className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1.5 transition-colors">
              <span>Last 7 Days</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center justify-end gap-4 text-[10px] font-bold text-slate-600 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6342ff]"></span>
              <span>Tickets Sold</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></span>
              <span>Collection (₹)</span>
            </div>
          </div>

          {/* Chart Canvas Container */}
          <div className="relative h-56 w-full">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>


        {/* Center: Tickets By Type Donut (4 cols) */}
        <div className="lg:col-span-4 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Tickets By Type</h3>

          <div className="flex items-center justify-center gap-4 my-auto">
            {/* Donut Chart Canvas with Center Text Overlay */}
            <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
              <Doughnut data={donutTypeData} options={donutTypeOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-black text-slate-900 leading-tight">{formatNumber(kpis.totalTicketsSold)}</span>
                <span className="text-[10px] font-bold text-slate-400">Sold</span>
              </div>
            </div>

            {/* Legend List */}
            <div className="space-y-2 text-[11px]">
              {ticketTypes.map((type) => {
                const pct = ((type.sold / kpis.totalTicketsSold) * 100).toFixed(1);
                return (
                  <div key={type.id} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: type.color }}></span>
                    <div>
                      <p className="font-bold text-slate-800 leading-none">{type.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{formatNumber(type.sold)} ({pct}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>


        {/* Right: Sales Summary Breakdown (3 cols) */}
        <div className="lg:col-span-3 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Sales Summary</h3>

          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {/* 1. Total Collection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Total Collection</span>
              </div>
              <span className="text-xs font-black text-slate-900">{formatINR(kpis.totalCollection)}</span>
            </div>

            {/* 2. Online Collection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Online Collection</span>
              </div>
              <span className="text-xs font-black text-slate-900">{formatINR(kpis.onlineCollection)}</span>
            </div>

            {/* 3. Offline Collection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xs">
                  <Store className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Offline Collection</span>
              </div>
              <span className="text-xs font-black text-slate-900">{formatINR(kpis.offlineCollection)}</span>
            </div>

            {/* 4. Cash Collection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xs">
                  <Banknote className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Cash Collection</span>
              </div>
              <span className="text-xs font-black text-slate-900">{formatINR(kpis.cashCollection)}</span>
            </div>

            {/* 5. UPI Collection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">UPI Collection</span>
              </div>
              <span className="text-xs font-black text-slate-900">{formatINR(kpis.upiCollection)}</span>
            </div>

            {/* 6. Average Ticket Value */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Average Ticket Value</span>
              </div>
              <span className="text-xs font-black text-slate-900">₹{kpis.averageTicketValue.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>


      {/* =========================================================
           3. THIRD ROW: BOOKING SOURCE, GATE ENTRY, RECENT BOOKINGS
           ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Booking Source Donut (3 cols) */}
        <div className="lg:col-span-3 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Booking Source</h3>

          <div className="flex items-center justify-center gap-4 my-auto">
            <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
              <Doughnut data={donutSourceData} options={donutSourceOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-black text-slate-900 leading-tight">{formatNumber(kpis.totalTicketsSold)}</span>
                <span className="text-[9px] font-bold text-slate-400">Total</span>
              </div>
            </div>

            {/* Legends */}
            <div className="space-y-3 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#6342ff] mt-0.5 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800 leading-none">Online</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatNumber(onlineCount)} ({kpis.totalTicketsSold > 0 ? ((onlineCount / kpis.totalTicketsSold) * 100).toFixed(1) : '0'}%)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] mt-0.5 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800 leading-none">Offline (Counter)</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatNumber(offlineCount)} ({kpis.totalTicketsSold > 0 ? ((offlineCount / kpis.totalTicketsSold) * 100).toFixed(1) : '0'}%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Center: Gate Entry Summary (5 cols) */}
        <div className="lg:col-span-5 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Gate Entry Summary</h3>
            <button 
              onClick={() => onNavigateTab('gates')}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <span>Today</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* 4 Gates Grid Cards */}
          <div className="grid grid-cols-4 gap-2.5">
            {gates.map((gate) => {
              const currentPct = Math.round((gate.entered / gate.capacity) * 100);
              return (
                <div key={gate.id} className={`${gate.bgLightClass} border ${gate.borderClass} rounded-2xl p-2.5 text-center flex flex-col justify-between`}>
                  <div className={`flex items-center justify-center gap-1 ${gate.textClass} text-[10px] font-extrabold uppercase truncate`}>
                    <DoorOpen className="w-3 h-3 flex-shrink-0" />
                    <span>{gate.name.split(' ')[0]} {gate.name.split(' ')[1]}</span>
                  </div>
                  <div className="my-1.5">
                    <span className="text-[9px] text-slate-400 font-bold block">Entered</span>
                    <span className="text-base font-black text-slate-900 leading-none">{formatNumber(gate.entered)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block">Capacity</span>
                    <span className="text-[11px] font-black text-slate-700">{formatNumber(gate.capacity)}</span>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div className={`${gate.barColor} h-1.5 rounded-full`} style={{ width: `${currentPct}%` }}></div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 block mt-1">{currentPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* Right: Recent Bookings Table (4 cols) */}
        <div className="lg:col-span-4 bg-[#eef1f8] rounded-2xl p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Recent Bookings</h3>
            <button 
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              View All
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-[9px] uppercase font-black text-slate-400 border-b border-slate-100 pb-1">
                  <th className="pb-1.5">Booking ID</th>
                  <th className="pb-1.5">Customer</th>
                  <th className="pb-1.5">Tickets</th>
                  <th className="pb-1.5">Amount</th>
                  <th className="pb-1.5 text-center">Source</th>
                  <th className="pb-1.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {recentBookings.slice(0, 5).map((b) => (
                  <tr 
                    key={b.id} 
                    onClick={() => onSelectBooking(b)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 text-indigo-700 font-bold">{b.ticketNumber}</td>
                    <td className="py-2 text-slate-900 font-bold truncate max-w-[90px]">{b.customerName}</td>
                    <td className="py-2 text-slate-600">{b.ticketTypeName} × {b.quantity}</td>
                    <td className="py-2 font-black text-slate-900">₹{b.amount}</td>
                    <td className="py-2 text-center">
                      {b.source === 'Online' ? (
                        <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                          Online
                        </span>
                      ) : (
                        <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-orange-200">
                          Counter
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-[10px] text-slate-400">{b.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>


      {/* =========================================================
           4. QUICK ACTIONS SECTION (7 ACTION BUTTONS)
           ========================================================= */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quick Actions</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          
          {/* 1. Create Event */}
          <button 
            onClick={onOpenCreateEvent}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Create Event</span>
          </button>

          {/* 2. Add Ticket Type */}
          <button 
            onClick={onOpenAddTicketType}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm flex-shrink-0">
              <PlusCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Add Ticket Type</span>
          </button>

          {/* 3. New Booking (Counter) */}
          <button 
            onClick={onOpenNewBooking}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm flex-shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">New Booking (Counter)</span>
          </button>

          {/* 4. View Bookings */}
          <button 
            onClick={() => onNavigateTab('bookings')}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm flex-shrink-0">
              <ListChecks className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">View Bookings</span>
          </button>

          {/* 5. Scan Ticket */}
          <button 
            onClick={onOpenScanner}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm flex-shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Scan Ticket</span>
          </button>

          {/* 6. Sales Report */}
          <button 
            onClick={() => onNavigateTab('reports')}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Sales Report</span>
          </button>

          {/* 7. Gate Entry Log */}
          <button 
            onClick={() => onNavigateTab('gates')}
            className="bg-[#eef1f8] hover:bg-[#e4e9f4] border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs transition-all active:scale-95 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-sm flex-shrink-0">
              <DoorOpen className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Gate Entry Log</span>
          </button>

        </div>
      </div>


      {/* =========================================================
           5. FOOTER SUMMARY KPI STRIP (DARK BLUE CONTAINER)
           ========================================================= */}
      <div className="bg-[#141a35] text-white rounded-2xl p-4 shadow-xl border border-indigo-800/50 grid grid-cols-2 md:grid-cols-6 gap-4 items-center divide-y md:divide-y-0 md:divide-x divide-indigo-800/50">
        
        {/* Total Events */}
        <div className="flex items-center gap-3 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center text-lg flex-shrink-0">
            <CalendarPlus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Current Event</span>
            <span className="text-sm font-black text-white leading-tight">{currentEvent ? currentEvent.title : 'None Selected'}</span>
            <span className="text-[9px] font-semibold text-slate-400 block">{currentEvent ? currentEvent.status : '—'}</span>
          </div>
        </div>

        {/* Total Ticket Types */}
        <div className="flex items-center gap-3 pl-0 md:pl-4 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center text-lg flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Ticket Types</span>
            <span className="text-sm font-black text-white leading-tight">{ticketTypes.length}</span>
            <span className="text-[9px] font-semibold text-slate-400 block">Active Types</span>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="flex items-center gap-3 pl-0 md:pl-4 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-teal-600/30 text-teal-400 flex items-center justify-center text-lg flex-shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Bookings</span>
            <span className="text-sm font-black text-white leading-tight">{formatNumber(kpis.totalTicketsSold)}</span>
            <span className="text-[9px] font-semibold text-slate-400 block">Tickets Sold</span>
          </div>
        </div>

        {/* Total Customers */}
        <div className="flex items-center gap-3 pl-0 md:pl-4 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-lg flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Customers</span>
            <span className="text-sm font-black text-white leading-tight">{formatNumber(recentBookings.length)}</span>
            <span className="text-[9px] font-semibold text-slate-400 block">Registered</span>
          </div>
        </div>

        {/* Tickets Scanned Today */}
        <div className="flex items-center gap-3 pl-0 md:pl-4 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center text-lg flex-shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Tickets Scanned</span>
            <span className="text-sm font-black text-white leading-tight">{formatNumber(kpis.peopleEntered)}</span>
            <span className="text-[9px] font-bold text-amber-400 block">{kpis.scannedTodayPercentage}% of Sold</span>
          </div>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-3 pl-0 md:pl-4 pt-2 md:pt-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base flex-shrink-0 relative">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-400 relative"></span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">System Status</span>
            <span className="text-xs font-black text-emerald-400 leading-tight">All Systems Operational</span>
          </div>
        </div>

      </div>

    </main>
  );
}
