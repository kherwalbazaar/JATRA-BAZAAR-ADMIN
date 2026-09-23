'use client';

import React from 'react';
import { 
  X, 
  Calendar, 
  MapPin, 
  Clock
} from 'lucide-react';
import { EventItem } from '@/types';

interface EventDetailsModalProps {
  event: EventItem | null;
  onClose: () => void;
}

export default function EventDetailsModal({
  event,
  onClose
}: EventDetailsModalProps) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Poster Header */}
        <div className="relative h-48 w-full bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Calendar className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider">Jatra Bazaar</span>
          </div>
          {event.poster && (
            <img
              src={event.poster}
              alt={event.title}
              className="relative w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded uppercase">
              {event.status}
            </span>
            <h3 className="text-lg font-black mt-1 leading-tight">{event.title}</h3>
            <p className="text-xs text-amber-200 font-semibold">{event.subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-semibold text-slate-700">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Date</span>
                <span className="font-bold text-slate-900">{event.date} ({event.day})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Show Timing</span>
                <span className="font-bold text-slate-900">{event.time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 col-span-2">
              <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Venue Location</span>
                <span className="font-bold text-slate-900">{event.city ? `${event.venue}, ${event.city}` : event.venue}</span>
                {event.address && event.address !== event.venue && <span className="block text-[11px] text-slate-500 font-semibold">{event.address}</span>}
              </div>
            </div>
          </div>

          {event.description && (
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">About</span>
              <p className="text-slate-700 leading-relaxed">{event.description}</p>
            </div>
          )}

          {(event.language || event.audience || event.phone || event.duration || event.entryTime || event.startTime) && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[11px]">
              {event.language && <div><span className="text-slate-400 font-bold block">Language</span><span className="font-bold text-slate-900">{event.language}</span></div>}
              {event.audience && <div><span className="text-slate-400 font-bold block">Audience</span><span className="font-bold text-slate-900">{event.audience}</span></div>}
              {event.entryTime && <div><span className="text-slate-400 font-bold block">Entry Time</span><span className="font-bold text-slate-900">{event.entryTime}</span></div>}
              {event.startTime && <div><span className="text-slate-400 font-bold block">Start Time</span><span className="font-bold text-slate-900">{event.startTime}</span></div>}
              {event.duration && <div><span className="text-slate-400 font-bold block">Duration</span><span className="font-bold text-slate-900">{event.duration}</span></div>}
              {event.phone && <div><span className="text-slate-400 font-bold block">Phone</span><span className="font-bold text-slate-900">{event.phone}</span></div>}
            </div>
          )}

          {(event.writer || event.director || event.musicDirector || event.singer) && (
            <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 text-[11px]">
              {event.writer && <div><span className="text-slate-400 font-bold block">Writer</span><span className="font-bold text-slate-900">{event.writer}</span></div>}
              {event.director && <div><span className="text-slate-400 font-bold block">Director</span><span className="font-bold text-slate-900">{event.director}</span></div>}
              {event.musicDirector && <div><span className="text-slate-400 font-bold block">Music Director</span><span className="font-bold text-slate-900">{event.musicDirector}</span></div>}
              {event.singer && <div><span className="text-slate-400 font-bold block">Singer</span><span className="font-bold text-slate-900">{event.singer}</span></div>}
            </div>
          )}

          {!!event.actors?.length && (
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-2">Cast & Crew</span>
              <div className="flex flex-wrap gap-3">
                {event.actors.filter((a) => a.name || a.photo).map((actor, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    {actor.photo && <img src={actor.photo} alt={actor.name} className="w-8 h-8 rounded-full object-cover" />}
                    <span className="text-xs font-bold text-slate-800">{actor.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.trailerUrl && (
            <a
              href={event.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-black text-red-600 hover:underline"
            >
              ▶ Watch Trailer
            </a>
          )}

        </div>
      </div>
    </div>
  );
}
