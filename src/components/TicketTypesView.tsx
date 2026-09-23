'use client';

import React from 'react';
import { 
  Ticket, 
  Plus, 
  CheckCircle, 
  DoorOpen, 
  Tag, 
  Users, 
  ArrowUpRight, 
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { TicketType, EventItem } from '@/types';
import { formatINR, formatNumber } from '@/lib/utils';

interface TicketTypesViewProps {
  currentEvent: EventItem | null;
  ticketTypes: TicketType[];
  onOpenAddTicketType: () => void;
  onUpdateQuota: (typeId: string, delta: number) => void;
}

export default function TicketTypesView({
  currentEvent,
  ticketTypes,
  onOpenAddTicketType,
  onUpdateQuota
}: TicketTypesViewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Ticket Categories & Pricing</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {ticketTypes.length} Tiers Configured
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Configured for: <span className="text-slate-700 font-bold">{currentEvent?.title ?? 'No event selected'}</span> {currentEvent?.venue ? `(${currentEvent.venue})` : ''}
          </p>
        </div>

        <button
          onClick={onOpenAddTicketType}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Ticket Category</span>
        </button>
      </div>

      {/* Ticket Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {ticketTypes.map((type) => {
          const soldPct = Math.round((type.sold / type.totalQuota) * 100);
          const revenue = type.sold * type.price;
          const remaining = type.totalQuota - type.sold;

          return (
            <div 
              key={type.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5" 
                style={{ backgroundColor: type.color }}
              ></div>

              <div>
                {/* Header Title & Price */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: type.color }}
                      ></span>
                      <h3 className="text-base font-black text-slate-900 leading-tight">
                        {type.name}
                      </h3>
                    </div>
                    {type.badgeText && (
                      <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                        {type.badgeText}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black text-slate-900">
                      ₹{type.price}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-bold">per seat</span>
                  </div>
                </div>

                {/* Sales Progress Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Sold vs Quota</span>
                    <span className="text-slate-900">{formatNumber(type.sold)} / {formatNumber(type.totalQuota)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${soldPct}%`, 
                        backgroundColor: type.color 
                      }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>{soldPct}% Filled</span>
                    <span className="text-indigo-600">{remaining} Available</span>
                  </div>
                </div>

                {/* Gate Access Badge */}
                <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Entry Gate:</span>
                  {type.gateAccess.map(gate => (
                    <span key={gate} className="text-[10px] bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <DoorOpen className="w-2.5 h-2.5 text-slate-500" />
                      <span>{gate}</span>
                    </span>
                  ))}
                </div>

                {/* Perks Checklist */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Included Benefits</span>
                  {type.perks.map((perk, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="truncate">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Summary & Quota Tweak */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Tier Revenue</span>
                  <span className="text-xs font-black text-slate-900">{formatINR(revenue)}</span>
                </div>

                {/* Quick Quota Adjuster */}
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => onUpdateQuota(type.id, -50)}
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center transition-colors"
                    title="Decrease quota by 50"
                  >
                    -
                  </button>
                  <button 
                    onClick={() => onUpdateQuota(type.id, 50)}
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center transition-colors"
                    title="Increase quota by 50"
                  >
                    +
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
