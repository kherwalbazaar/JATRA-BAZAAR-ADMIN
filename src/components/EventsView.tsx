'use client';

import React, { useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Coins, 
  Plus, 
  CalendarCheck, 
  Sparkles, 
  CheckCircle2,
  ExternalLink,
  Edit,
  Trash2,
  MoreVertical,
  AlertTriangle,
  X
} from 'lucide-react';
import { EventItem } from '@/types';

interface EventsViewProps {
  eventsList: EventItem[];
  currentEvent: EventItem | null;
  onSelectEvent: (event: EventItem) => void;
  onOpenCreateEvent: () => void;
  onViewEventDetails: (event: EventItem) => void;
  onEditEvent: (event: EventItem) => void;
  onDeleteEvent: (eventId: string) => void;
}

export default function EventsView({
  eventsList,
  currentEvent,
  onSelectEvent,
  onOpenCreateEvent,
  onViewEventDetails,
  onEditEvent,
  onDeleteEvent
}: EventsViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'edit' | 'delete'; event: EventItem | null }>({ type: 'edit', event: null });

  const filteredEvents = eventsList.filter(evt => {
    if (filter === 'all') return true;
    return evt.status === filter;
  });

  return (
    <div className="p-6 space-y-6" onClick={() => setOpenMenuId(null)}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Jatra Bazaar Events Directory</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {eventsList.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Manage stage productions, show schedules, ticket allocations, and venues.
          </p>
        </div>

        <button
          onClick={onOpenCreateEvent}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(['all', 'active', 'upcoming', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
              filter === tab
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
            <Calendar className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-1">No Events Found</h3>
          <p className="text-sm text-slate-400 font-semibold max-w-sm mb-6">
            {eventsList.length === 0
              ? "You haven't created any events yet. Create your first event to get started."
              : `No ${filter} events found. Try a different filter or create a new event.`}
          </p>
          <button
            onClick={onOpenCreateEvent}
            className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Event</span>
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredEvents.map((evt) => {
          const isCurrent = currentEvent !== null && evt.id === currentEvent.id;

          return (
            <div 
              key={evt.id}
              className={`bg-white rounded-2xl border-2 border-blue-500 transition-all duration-200 overflow-hidden flex flex-col justify-between hover:shadow-lg hover:shadow-blue-500/20 ${
                isCurrent ? 'shadow-md shadow-blue-500/30' : 'shadow-xs'
              }`}
            >
              {/* Event Poster Image */}
              <div className="relative h-32 w-full overflow-hidden group bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700">
                {/* Fallback shown when poster is missing or fails to load */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider">Jatra Bazaar</span>
                </div>
                {evt.poster && (
                  <img 
                    src={evt.poster} 
                    alt={evt.title} 
                    className="relative w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20"></div>

                {/* Sale Mode Badge (opposite side of 3-dot menu) */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide shadow-md animate-sale-blink ${
                      (evt.saleMode || 'Counter') === 'Online'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white text-slate-700'
                    }`}
                  >
                    {evt.saleMode || 'Counter'}
                  </span>
                </div>

                {/* 3-Dot Menu */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === evt.id ? null : evt.id);
                    }}
                    className="w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 transition-colors shadow-md"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === evt.id && (
                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setConfirmModal({ type: 'edit', event: evt });
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <Edit className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setConfirmModal({ type: 'delete', event: evt });
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Details Body */}
              <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                    {evt.partyName || evt.title}
                  </h3>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                    <span className="font-bold text-slate-800">{evt.date} ({evt.day})</span>
                  </div>

                  {evt.committeeName && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate font-semibold text-slate-700">{evt.committeeName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                    <span className="truncate font-semibold text-slate-700">{evt.committeeLocation || evt.venue}</span>
                  </div>
                </div>
              </div>

              {/* Details button — flush to left/right/bottom, no rounded corners */}
              <button
                onClick={() => onViewEventDetails(evt)}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <span>Details</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.event && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                confirmModal.type === 'delete' ? 'bg-red-100' : 'bg-indigo-100'
              }`}>
                {confirmModal.type === 'delete' ? (
                  <AlertTriangle className="w-7 h-7 text-red-600" />
                ) : (
                  <Edit className="w-7 h-7 text-indigo-600" />
                )}
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                {confirmModal.type === 'delete' ? 'Delete Event?' : 'Edit Event?'}
              </h3>
              <p className="text-sm text-slate-500 font-semibold">
                {confirmModal.type === 'delete' 
                  ? `Are you sure you want to delete "${confirmModal.event.title}"? This action cannot be undone.`
                  : `Do you want to edit "${confirmModal.event.title}"?`}
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmModal({ type: 'edit', event: null })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmModal.type === 'delete' && confirmModal.event) {
                    console.log('EventsView: Deleting event with ID:', confirmModal.event.id);
                    try {
                      await onDeleteEvent(confirmModal.event.id);
                      console.log('EventsView: Delete completed successfully');
                    } catch (err) {
                      console.error('EventsView: Delete failed with error:', err);
                      alert('Failed to delete event. Please try again.');
                    }
                  } else if (confirmModal.type === 'edit' && confirmModal.event) {
                    onEditEvent(confirmModal.event);
                  }
                  setConfirmModal({ type: 'edit', event: null });
                }}
                className={`flex-1 py-2.5 text-white text-xs font-black rounded-xl transition-colors ${
                  confirmModal.type === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-[#4f39f6] hover:bg-[#432ee0]'
                }`}
              >
                {confirmModal.type === 'delete' ? 'Yes, Delete' : 'Yes, Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
