'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Users,
  Languages,
  Ticket,
  Music,
  PenLine,
  Mic2,
  Clapperboard,
  Link2,
  Film,
  BookOpen,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '@/lib/firebase';
import { EventItem } from '@/types';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-[10px] text-slate-400 font-bold uppercase block">{label}</span>
        <span className="text-xs font-bold text-slate-800 break-words">{value}</span>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center flex-shrink-0">{n}</span>
        <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h2>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      {children}
    </div>
  );
}

function EventDetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<EventItem | null>(null);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.EVENTS, id));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setEvent({ id: snap.id, ...snap.data() } as EventItem);
        }
      } catch (err) {
        console.error('Failed to load event details:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fc] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading event details...
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-[#f4f6fc] flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-bold text-slate-500">Event not found</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const actors = (event.actors || []).filter((a) => a.name || a.photo);
  const banners = (event.additionalBanners || []).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      {/* Top Bar */}
      <div className="bg-[#0f1430] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-black tracking-wide">Event Details</h1>
            <p className="text-[10px] text-slate-400 font-semibold">{event.partyName || event.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Poster Header */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700 min-h-[16rem]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
            <span className="text-xs font-black uppercase tracking-wider">Jatra Bazaar</span>
          </div>
          {event.poster && (
            <img
              src={event.poster}
              alt={event.title}
              className="relative w-full h-auto block"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded uppercase">
              {event.status}
            </span>
            <h2 className="text-xl font-black mt-1.5 leading-tight">{event.partyName || event.title}</h2>
            <p className="text-xs text-amber-200 font-semibold">{event.eventTitle}</p>
          </div>
        </div>

        {/* 1. Event Details */}
        <Section n={1} title="Event Details">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Row icon={<Users className="w-3.5 h-3.5 text-indigo-600" />} label="Party Name" value={event.partyName} />
            <Row icon={<BookOpen className="w-3.5 h-3.5 text-indigo-600" />} label="Story Name" value={event.title} />
            <Row icon={<Film className="w-3.5 h-3.5 text-indigo-600" />} label="Event Title" value={event.eventTitle} />
            <Row icon={<Users className="w-3.5 h-3.5 text-emerald-600" />} label="Committee Name" value={event.committeeName} />
            <Row icon={<MapPin className="w-3.5 h-3.5 text-emerald-600" />} label="Committee Location" value={event.committeeLocation} />
            <Row icon={<Languages className="w-3.5 h-3.5 text-blue-600" />} label="Language" value={event.language} />
            <Row icon={<Users className="w-3.5 h-3.5 text-blue-600" />} label="Audience" value={event.audience} />
            <Row icon={<Ticket className="w-3.5 h-3.5 text-amber-600" />} label="Ticket Selling" value={event.saleMode} />
            <Row icon={<Calendar className="w-3.5 h-3.5 text-rose-500" />} label="Event Date" value={event.date ? `${event.date}${event.day ? ` (${event.day})` : ''}` : undefined} />
          </div>
          {event.description && (
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">About</span>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">{event.description}</p>
            </div>
          )}
        </Section>

        {/* 2. Date & Time */}
        <Section n={2} title="Date & Time">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Row icon={<Clock className="w-3.5 h-3.5 text-indigo-600" />} label="Gate Entry" value={event.entryTime} />
            <Row icon={<Clock className="w-3.5 h-3.5 text-blue-600" />} label="Event Start" value={event.startTime} />
            <Row icon={<Clock className="w-3.5 h-3.5 text-rose-500" />} label="End Time" value={event.endTime} />
            <Row icon={<Clock className="w-3.5 h-3.5 text-emerald-600" />} label="Duration" value={event.duration} />
          </div>
          {event.time && (
            <div className="pt-3 border-t border-slate-100">
              <Row icon={<Film className="w-3.5 h-3.5 text-amber-600" />} label="Show Timing" value={event.time} />
            </div>
          )}
        </Section>

        {/* 3. Party Contact Details */}
        <Section n={3} title="Party Contact Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Row icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />} label="Address" value={event.address || event.venue} />
            <Row icon={<Phone className="w-3.5 h-3.5 text-emerald-600" />} label="Phone Number" value={event.phone} />
          </div>
        </Section>

        {/* 4. Cast & Crew */}
        {actors.length > 0 && (
          <Section n={4} title="Cast & Crew">
            <div className="flex flex-wrap gap-3">
              {actors.map((actor, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  {actor.photo ? (
                    <img
                      src={actor.photo}
                      alt={actor.name}
                      className="w-10 h-10 rounded-full object-cover bg-slate-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">
                      {(actor.name || '?').charAt(0)}
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-800">{actor.name}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 5. Banner */}
        <Section n={5} title="Banner">
          {event.poster && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src={event.poster}
                alt="Main banner"
                className="w-full h-auto block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          {banners.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {banners.map((b, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={b}
                    alt={`Additional banner ${i + 1}`}
                    className="w-full h-auto block"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 6. Creative */}
        <Section n={6} title="Creative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Row icon={<PenLine className="w-3.5 h-3.5 text-indigo-600" />} label="Writer" value={event.writer} />
            <Row icon={<Clapperboard className="w-3.5 h-3.5 text-blue-600" />} label="Director" value={event.director} />
            <Row icon={<Music className="w-3.5 h-3.5 text-emerald-600" />} label="Music Director" value={event.musicDirector} />
            <Row icon={<Mic2 className="w-3.5 h-3.5 text-rose-500" />} label="Singer" value={event.singer} />
          </div>
        </Section>

        {/* 7. Trailer */}
        {event.trailerUrl && (
          <Section n={7} title="Trailer">
            <a
              href={event.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-black rounded-xl transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Watch YouTube Trailer
            </a>
          </Section>
        )}
      </div>
    </div>
  );
}

export default function EventDetailsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f6fc] flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      }
    >
      <EventDetailsPage />
    </Suspense>
  );
}
