'use client';

import React from 'react';
import { 
  DoorOpen, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ShieldAlert, 
  ArrowUpRight,
  RefreshCw,
  Sliders,
  Sparkles
} from 'lucide-react';
import { GateInfo, EventItem } from '@/types';
import { formatNumber } from '@/lib/utils';

interface GateManagementViewProps {
  currentEvent: EventItem | null;
  gates: GateInfo[];
  onIncrementGate: (gateId: string) => void;
  onDecrementGate: (gateId: string) => void;
  onResetGate: (gateId: string) => void;
}

export default function GateManagementView({
  currentEvent,
  gates,
  onIncrementGate,
  onDecrementGate,
  onResetGate
}: GateManagementViewProps) {
  const totalEntered = gates.reduce((acc, g) => acc + g.entered, 0);
  const totalCapacity = gates.reduce((acc, g) => acc + g.capacity, 0);
  const overallPercentage = Math.round((totalEntered / totalCapacity) * 100);

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Gate Access & Turnstile Control</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Monitor real-time audience footfall per entry gate and control entry pacing at <span className="text-slate-700 font-bold">{currentEvent?.venue ?? 'the venue'}</span>.
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-2 flex items-center gap-4 shadow-xs">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Inside Venue</span>
            <span className="text-base font-black text-slate-900 leading-none">{formatNumber(totalEntered)} / {formatNumber(totalCapacity)}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Occupancy</span>
            <span className="text-base font-black text-indigo-600 leading-none">{overallPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Gates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {gates.map((gate) => {
          const pct = Math.round((gate.entered / gate.capacity) * 100);
          const isCrowded = pct >= 80;

          return (
            <div 
              key={gate.id}
              className={`bg-white rounded-2xl border ${gate.borderClass} p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4`}
            >
              <div>
                {/* Gate Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${gate.bgLightClass} ${gate.textClass} flex items-center justify-center font-black`}>
                      <DoorOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 leading-tight">
                        {gate.name}
                      </h3>
                      <span className="text-[9px] text-slate-400 font-bold">
                        Turnstile active
                      </span>
                    </div>
                  </div>

                  {isCrowded ? (
                    <span className="text-[9px] bg-rose-100 text-rose-700 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Heavy
                    </span>
                  ) : (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Normal
                    </span>
                  )}
                </div>

                {/* Big Number Counters */}
                <div className="my-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Entered Today</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(gate.entered)}</span>
                    <span className="text-xs font-bold text-slate-400">/ {formatNumber(gate.capacity)} capacity</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-300 ${gate.barColor}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>{pct}% Load</span>
                    <span>{gate.capacity - gate.entered} slots free</span>
                  </div>
                </div>

                {/* Assigned Ticket Tiers */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Categories:</span>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {gate.assignedTicketTypes.map(t => (
                      <span key={t} className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation / Counter Controller Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Manual Tap:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDecrementGate(gate.id)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                    title="Undo 1 entry"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => onIncrementGate(gate.id)}
                    className="px-2.5 py-1 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                    title="Simulate 1 entry scan"
                  >
                    +1 Scan
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
