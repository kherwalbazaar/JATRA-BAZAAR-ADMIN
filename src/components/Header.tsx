'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Check
} from 'lucide-react';
import { EventItem } from '@/types';

interface HeaderProps {
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
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const eventMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <header className={`px-6 py-4 border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-20 shadow-xs transition-colors duration-200 ${
      isBlinking ? 'animate-header-blink' : 'bg-white'
    }`}>
      <div className="flex items-center gap-6">
      </div>

      {/* Top Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar */}
        <div className="hidden xl:flex items-center relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search booking ID, customer, ticket..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>

        {/* Firebase Live Status Badge */}
        {isLoading ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs font-bold text-indigo-600 select-none">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        ) : isConnectionLost ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200/80 rounded-xl text-xs font-bold text-red-600 select-none animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Reconnecting...</span>
          </div>
        ) : isSyncing ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-600 select-none">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        ) : isLiveConnected ? (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-700 select-none">
            <Check className="w-3 h-3" />
            <span>Up to date</span>
          </div>
        ) : (
          <button
            onClick={onRefresh}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 transition-colors select-none"
            title="Click to reconnect to Firebase"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Cached / Demo Data</span>
            <span className="text-[10px] underline ml-0.5">Sync</span>
          </button>
        )}

        {/* Date Selector Pill */}
        {currentEvent && (
        <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 select-none">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>{currentEvent.date} ({currentEvent.day.slice(0, 3)})</span>
        </div>
        )}

        {/* Event Dropdown Pill */}
        <div className="relative" ref={eventMenuRef}>
          <button
            onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
            className="flex items-center gap-2.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 transition-colors"
          >
            {currentEvent ? (
              <>
                <img 
                  src={currentEvent.poster} 
                  alt="Icon" 
                  className="w-6 h-6 rounded-lg object-cover ring-1 ring-slate-200"
                />
                <span className="max-w-[140px] truncate">{currentEvent.title}</span>
              </>
            ) : (
              <span className="text-slate-400">Select Event</span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
          </button>

          {eventDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Switch Active Event
              </div>
              <div className="py-1 space-y-1">
                {eventsList.map((evt) => {
                  const isSelected = currentEvent !== null && evt.id === currentEvent.id;
                  return (
                    <button
                      key={evt.id}
                      onClick={() => {
                        onSelectEvent(evt);
                        setEventDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                        isSelected ? 'bg-indigo-50/80 text-indigo-900 border border-indigo-100 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <img src={evt.poster} alt={evt.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black truncate">{evt.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{evt.date} • {evt.venue}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Center */}
        <div className="relative" ref={notifMenuRef}>
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-9 h-9 rounded-xl bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200 text-slate-700 flex items-center justify-center relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white"></span>
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
            className="flex items-center gap-2.5 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm ring-2 ring-indigo-500/40 relative">
              <User className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0"></span>
            </div>
            <div className="leading-tight text-left hidden sm:block">
              <span className="text-xs font-black text-slate-900 block flex items-center gap-1">
                Admin <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
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
