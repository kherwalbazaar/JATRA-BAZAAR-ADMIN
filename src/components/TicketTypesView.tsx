'use client';

import React, { useEffect, useState } from 'react';
import { 
  Ticket, 
  Plus, 
  CheckCircle, 
  DoorOpen, 
  Tag, 
  Users, 
  ArrowUpRight, 
  ShieldCheck,
  Edit2,
  Star,
  QrCode,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { TicketType, EventItem } from '@/types';
import { formatINR, formatNumber } from '@/lib/utils';

interface TicketTypesViewProps {
  currentEvent: EventItem | null;
  ticketTypes: TicketType[];
  onOpenAddTicketType: () => void;
  onEditTicketType: (type: TicketType) => void;
  onDeleteTicketType: (type: TicketType) => void;
  onUpdateQuota: (typeId: string, delta: number) => void;
  peopleEntered?: number;
}

export default function TicketTypesView({
  currentEvent,
  ticketTypes,
  onOpenAddTicketType,
  onEditTicketType,
  onDeleteTicketType,
  onUpdateQuota,
  peopleEntered = 0,
}: TicketTypesViewProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-ticket-menu]') || t?.closest('[data-ticket-menu-btn]')) return;
      setMenuFor(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [menuFor]);
  return (
    <div className="px-6 pt-6 pb-2 space-y-6">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {ticketTypes.map((type) => {
          const soldPct = Math.round((type.sold / type.totalQuota) * 100);
          const remaining = type.totalQuota - type.sold;

          return (
            <div 
              key={type.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-4 flex flex-col space-y-2 relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5" 
                style={{ backgroundColor: type.color }}
              ></div>

              <div>
                {/* Committee Name + 3-dot menu */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    {type.committeeName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <Tag className="w-2.5 h-2.5" />
                        {type.committeeName}
                      </span>
                    )}
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      data-ticket-menu-btn
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor(menuFor === type.id ? null : type.id);
                      }}
                      className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center transition-colors"
                      aria-label="Ticket type actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuFor === type.id && (
                      <div
                        data-ticket-menu
                        className="absolute right-0 top-8 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-36 text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(null);
                            onEditTicketType(type);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(null);
                            onDeleteTicketType(type);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                    </div>
                    {type.badgeText && (
                      <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                        {type.badgeText}
                      </span>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xl font-black text-slate-900">
                      ₹{type.price}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-bold">per seat</span>
                  </div>
                </div>

                {/* Sales Progress Bar */}
                <div className="mt-2 space-y-1">
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

                {/* QR Entries inside hall */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">QR Entry in Hall:</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <QrCode className="w-2.5 h-2.5" />
                    <span>{formatNumber(peopleEntered)} persons</span>
                  </span>
                </div>

                {/* Perks Checklist */}
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {type.perks.map((perk, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="truncate">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
