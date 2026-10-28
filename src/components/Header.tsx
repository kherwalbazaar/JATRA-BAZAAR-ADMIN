'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  User, 
  Bell, 
  Search, 
  CheckCircle2, 
  Ticket, 
  AlertCircle,
  ExternalLink,
  LogOut,
  Sliders,
  RefreshCw,
  Check,
  Clock
} from 'lucide-react';
import { EventItem } from '@/types';
import { getEventExpiryInfo, getEventLogoImage } from '@/lib/utils';

interface HeaderProps {
  sectionTitle?: string;
  currentEvent: EventItem | null;
  eventsList: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenScanner: () => void;
  onOpenNewBooking: () => void;
  isLiveConnected?: boolean;
  isLoading?: boolean;
  isSyncing?: boolean;
  isConnectionLost?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
}

export default function Header({
  sectionTitle,
  currentEvent,
  eventsList,
  onSelectEvent,
  searchQuery,
  onSearchChange,
  onOpenScanner,
  onOpenNewBooking,
  isLiveConnected = false,
  isLoading = false,
  isSyncing = false,
  isConnectionLost = false,
  lastUpdated,
  onRefresh
}: HeaderProps) {
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [eventFilterQuery, setEventFilterQuery] = useState('');
  const [eventTab, setEventTab] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const eventMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upcomingEvents = useMemo(() => {
    return eventsList.filter((e) => !getEventExpiryInfo(e).isExpired && e.status !== 'completed');
  }, [eventsList]);

  const pastEvents = useMemo(() => {
    return eventsList.filter((e) => getEventExpiryInfo(e).isExpired || e.status === 'completed');
  }, [eventsList]);

  const currentExpiry = useMemo(() => (currentEvent ? getEventExpiryInfo(currentEvent) : null), [currentEvent]);
  const isCurrentUpcoming = currentEvent ? (!currentExpiry?.isExpired && currentEvent.status !== 'completed') : false;
  const isCurrentActive = currentEvent?.status === 'active';

  const filteredEventsList: EventItem[] = useMemo(() => {
    let list: EventItem[] = [];
    if (eventTab === 'upcoming') {
      list = [...upcomingEvents].sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });
    } else if (eventTab === 'past') {
      list = [...pastEvents].sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tB - tA;
      });
    } else {
      const up = [...upcomingEvents].sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });
      const pst = [...pastEvents].sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tB - tA;
      });
      list = [...up, ...pst];
    }

    if (!eventFilterQuery.trim()) return list;
    const q = eventFilterQuery.toLowerCase();
    return list.filter((e) =>
      e.title?.toLowerCase().includes(q) ||
      e.partyName?.toLowerCase().includes(q) ||
      e.organizer?.toLowerCase().includes(q) ||
      e.date?.toLowerCase().includes(q) ||
      e.venue?.toLowerCase().includes(q) ||
      e.writer?.toLowerCase().includes(q) ||
      e.committeeName?.toLowerCase().includes(q)
    );
  }, [eventTab, upcomingEvents, pastEvents, eventFilterQuery]);

  // Play chime sound using Web Audio API
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [880, 1108.73, 1318.51];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    } catch {}
  }, []);

  // Trigger blink + sound when syncing from external change
  useEffect(() => {
    if (isSyncing && !isLoading) {
      playChime();
      setIsBlinking(true);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      blinkTimerRef.current = setTimeout(() => setIsBlinking(false), 2400);
    }
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [isSyncing, isLoading, playChime]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (eventMenuRef.current && !eventMenuRef.current.contains(event.target as Node)) {
        setEventDropdownOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 z-20 shadow-md relative transition-colors duration-200 ${
      isBlinking ? 'animate-header-blink' : 'bg-[#12193b]'
    }`}>
      {/* Active Section Heading (left of the search bar) */}
      <div className="flex items-center gap-3 min-w-0">
        {sectionTitle && (
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white leading-tight truncate">
              {sectionTitle}
            </h1>
          </div>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar */}
        <div className="hidden xl:flex items-center relative flex-1">
          <Search className="w-4 h-4 text-slate-300 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search booking ID, customer, ticket..."
            className="w-full pl-9 pr-3 py-1.5 bg-white/10 hover:bg-white/15 focus:bg-white/15 text-xs font-semibold text-white placeholder:text-slate-300 rounded-xl border border-white/10 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 outline-none transition-all"
          />
        </div>

        {/* Firebase Live Status Badge */}
        {isLoading ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-xs font-bold text-indigo-200 select-none">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        ) : isConnectionLost ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-400/30 rounded-xl text-xs font-bold text-red-300 select-none animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Reconnecting...</span>
          </div>
        ) : isSyncing ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-xs font-bold text-blue-300 select-none">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        ) : isLiveConnected ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-xs font-bold text-emerald-300 select-none">
            <Check className="w-3 h-3" />
            <span>Up to date</span>
          </div>
        ) : (
          <button
            onClick={onRefresh}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 rounded-xl text-xs font-bold text-amber-300 transition-colors select-none"
            title="Click to reconnect to Firebase"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Cached / Demo Data</span>
            <span className="text-[10px] underline ml-0.5">Sync</span>
          </button>
        )}

        {/* Header Events Selection Dropdown */}
        <div className="relative" ref={eventMenuRef}>
          <button
            type="button"
            onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
            className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/15 hover:border-amber-400/50 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all text-left max-w-[260px] sm:max-w-[340px] md:max-w-[420px] shadow-sm"
            title="Click to switch active show/event"
          >
            {currentEvent ? (
              <>
                {currentEvent.poster ? (
                  <img 
                    src={currentEvent.poster} 
                    alt={currentEvent.title} 
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 flex items-center justify-center font-black text-sm flex-shrink-0">
                    🎭
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-none mb-1">
                    {/* Status Pill on Header button */}
                    {isCurrentUpcoming ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/25 px-1.5 py-0.5 rounded border border-emerald-400/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Upcoming</span>
                      </span>
                    ) : isCurrentActive ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-400/40">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/25 px-1.5 py-0.5 rounded border border-rose-400/40 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-rose-300" />
                        <span>Past</span>
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30 truncate">
                      {currentEvent.date || 'Date TBD'}
                    </span>
                    <span className="text-[11px] font-extrabold text-indigo-200 truncate">
                      {currentEvent.partyName || currentEvent.organizer || 'Party'}
                    </span>
                  </div>
                  <div className="text-xs font-black text-white truncate leading-tight">
                    {currentEvent.title}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 py-0.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 font-bold">Select Event • Party • Story</span>
              </div>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 transition-transform duration-200 ml-1 ${
                eventDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Card-Style List Dropdown Panel */}
          {eventDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[min(94vw,460px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[500px] overflow-y-auto">
              <div className="px-2.5 py-1.5 mb-2 flex items-center justify-between border-b border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Select Event • Party • Story
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {eventsList.length} Total Shows
                </span>
              </div>

              {/* Status Filter Tabs: Upcoming (Selected by default), All, Past */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-2">
                <button
                  type="button"
                  onClick={() => setEventTab('upcoming')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    eventTab === 'upcoming'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>Upcoming</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      eventTab === 'upcoming'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {upcomingEvents.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEventTab('all')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    eventTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>All</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      eventTab === 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {eventsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEventTab('past')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    eventTab === 'past'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>Past</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      eventTab === 'past'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {pastEvents.length}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2 px-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={eventFilterQuery}
                  onChange={(e) => setEventFilterQuery(e.target.value)}
                  placeholder={
                    eventTab === 'upcoming'
                      ? 'Search upcoming shows, party, venue...'
                      : eventTab === 'past'
                      ? 'Search past shows, party, venue...'
                      : 'Search all shows, party, date, venue...'
                  }
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              {filteredEventsList.length === 0 ? (
                <div className="p-5 text-center space-y-2">
                  <p className="text-xs text-slate-500 font-semibold">
                    {eventFilterQuery.trim()
                      ? 'No events match your search query.'
                      : eventTab === 'upcoming'
                      ? 'No upcoming events found.'
                      : eventTab === 'past'
                      ? 'No past events found.'
                      : 'No events found.'}
                  </p>
                  {eventTab === 'upcoming' && eventsList.length > 0 && !eventFilterQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setEventTab('all')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline inline-block"
                    >
                      View All Shows ({eventsList.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredEventsList.map((evt) => {
                    const isSelected = currentEvent !== null && evt.id === currentEvent.id;
                    const evtExpiry = getEventExpiryInfo(evt);
                    const isEvtUpcoming = !evtExpiry.isExpired && evt.status !== 'completed';
                    const isEvtActive = evt.status === 'active';
                    const party = evt.partyName || evt.organizer || 'Party';
                    const committee = evt.committeeName || '';

                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => {
                          onSelectEvent(evt);
                          setEventDropdownOpen(false);
                          setEventFilterQuery('');
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50/70 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs text-slate-700'
                        }`}
                      >
                        {/* Logo / Icon */}
                        {getEventLogoImage(evt) ? (
                          <img
                            src={getEventLogoImage(evt)}
                            alt={evt.title}
                            className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                            🎭
                          </div>
                        )}

                        {/* Card Content:
                            1. Upcoming/past - events date - party name
                            2. below: committee name
                            3. below: story name in one line */}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Row 1: Upcoming/past - events date - party name */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                            {/* Upcoming / Past / Active Badge */}
                            {isEvtUpcoming ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Upcoming</span>
                              </span>
                            ) : isEvtActive ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-200/90 px-1.5 py-0.5 rounded-md shrink-0">
                                <Clock className="w-2.5 h-2.5 text-slate-500" />
                                <span>Past</span>
                              </span>
                            )}

                            {/* Events Date */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded-md shrink-0">
                              <Calendar className="w-3 h-3 text-indigo-600" />
                              <span>{evt.date || 'Date TBD'}</span>
                            </span>

                            {/* Party Name */}
                            <span className="text-[10px] font-black text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-md truncate min-w-0">
                              🎭 {party}
                            </span>
                          </div>

                          {/* Row 2: Committee Name */}
                          {committee && (
                            <div className="text-[10px] font-bold text-slate-500 truncate flex items-center gap-1">
                              <span>🏛️</span>
                              <span className="truncate">{committee}</span>
                            </div>
                          )}

                          {/* Row 3: Story Name in one line */}
                          <div 
                            className="text-xs font-black text-slate-900 truncate whitespace-nowrap overflow-hidden leading-tight"
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        </div>

                        {/* Selection Checkmark */}
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications Center */}
        <div className="relative" ref={notifMenuRef}>
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white flex items-center justify-center relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-[#12193b]"></span>
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900">Notifications</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">3 New</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-100 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">Gate C Capacity at 46%</p>
                    <p className="text-[10px] text-amber-700">Pacing fast, consider opening turnstile 2.</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <Ticket className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-800">50 VIP Tickets Booked</p>
                    <p className="text-[10px] text-slate-500">Online batch processed via PhonePe UPI.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin Profile Pill */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2.5 pl-2 border-l border-white/10 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-sm ring-2 ring-indigo-400/40 relative">
              <User className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#12193b] absolute bottom-0 right-0"></span>
            </div>
            <div className="leading-tight text-left hidden sm:block">
              <span className="text-xs font-black text-white block flex items-center gap-1">
                Admin <ChevronDown className="w-2.5 h-2.5 text-slate-300" />
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Super Admin</span>
            </div>
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-black text-slate-900">Admin Console</p>
                <p className="text-[10px] text-slate-400">admin@jatrabazaar.in</p>
              </div>
              <div className="py-1 text-xs font-semibold text-slate-700">
                <button className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-left">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Settings</span>
                </button>
                <button className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-left">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Audience Booking Portal</span>
                </button>
                <button className="w-full px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 text-left">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
