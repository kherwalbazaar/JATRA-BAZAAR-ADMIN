'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  LayoutGrid, 
  CalendarCheck, 
  Ticket, 
  CreditCard, 
  Users, 
  Store, 
  DoorOpen, 
  TrendingUp, 
  Megaphone, 
  Settings, 
  ShieldCheck, 
  FileText, 
  HelpCircle, 
  MapPin, 
  Calendar,
  ArrowRight,
  Sparkles,
  ChevronDown,
  History,
  Armchair,
  ShoppingCart,
  Globe
} from 'lucide-react';
import { NavigationTab, EventItem } from '@/types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  currentEvent: EventItem | null;
  onViewEventDetails: (event: EventItem) => void;
}

export const NAV_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Events',
  'tickets-types': 'Ticket Types',
  'create-seat': 'Create Seat',
  'counter-booking': 'Counter Booking',
  tickets: 'Scanner',
  'scan-history': 'Scan History',
  'online-history': 'Online History',
  payments: 'Payments',
  customers: 'Customers',
  counters: 'Counter Management',
  gates: 'Gate Management',
  reports: 'Reports & Analytics',
  marketing: 'Marketing',
  settings: 'Settings',
  users: 'Users & Roles',
  logs: 'System Logs',
  support: 'Support',
};

export default function Sidebar({
  currentTab,
  onTabChange,
  currentEvent,
  onViewEventDetails
}: SidebarProps) {
  const [reportsOpen, setReportsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: NAV_LABELS.dashboard, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'events', label: NAV_LABELS.events, icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'tickets-types', label: NAV_LABELS['tickets-types'], icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'create-seat', label: NAV_LABELS['create-seat'], icon: <Armchair className="w-4 h-4" /> },
    { id: 'counter-booking', label: NAV_LABELS['counter-booking'], icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'tickets', label: NAV_LABELS.tickets, icon: <Ticket className="w-4 h-4" /> },
    { id: 'scan-history', label: NAV_LABELS['scan-history'], icon: <History className="w-4 h-4" /> },
    { id: 'online-history', label: NAV_LABELS['online-history'], icon: <Globe className="w-4 h-4" /> },
    { id: 'payments', label: NAV_LABELS.payments, icon: <CreditCard className="w-4 h-4" /> },
    { id: 'customers', label: NAV_LABELS.customers, icon: <Users className="w-4 h-4" /> },
    { id: 'counters', label: NAV_LABELS.counters, icon: <Store className="w-4 h-4" /> },
    { id: 'gates', label: NAV_LABELS.gates, icon: <DoorOpen className="w-4 h-4" /> },
    { id: 'reports', label: NAV_LABELS.reports, icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'marketing', label: NAV_LABELS.marketing, icon: <Megaphone className="w-4 h-4" /> },
    { id: 'settings', label: NAV_LABELS.settings, icon: <Settings className="w-4 h-4" /> },
    { id: 'users', label: NAV_LABELS.users, icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'logs', label: NAV_LABELS.logs, icon: <FileText className="w-4 h-4" /> },
    { id: 'support', label: NAV_LABELS.support, icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-[#0f1430] text-slate-300 flex flex-col justify-between flex-shrink-0 z-30 select-none border-r border-indigo-950/60 min-h-screen">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Logo Header */}
        <div className="px-5 py-5 border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-[#181d45] rounded-full flex items-center justify-center text-amber-400 text-xl font-black">
                🎭
              </div>
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-black text-white tracking-wider flex items-center gap-1">
                <span className="text-amber-400">JATRA</span>
                <span>BAZAAR</span>
              </h1>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Admin Panel</p>
            </div>
          </div>

          {/* Admin Badge Pill */}
          <div className="mt-3.5 flex justify-center">
            <span className="w-full text-center bg-[#292275] border border-indigo-500/30 text-indigo-200 text-[10px] font-black tracking-widest uppercase py-1 px-3 rounded-md shadow-xs flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Admin Panel</span>
            </span>
          </div>
        </div>

        {/* Navigation Menu List */}
        <nav className="px-3 py-4 space-y-1 text-xs font-semibold">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-[#4f39f6] text-white shadow-md shadow-indigo-600/30 font-bold translate-x-1'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400'} flex-shrink-0`}>
                  {item.icon}
                </div>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Bottom: Current Event Box */}
      <div className="p-3 border-t border-indigo-950/60">
        <div className="bg-[#181e42] border border-indigo-800/50 rounded-2xl p-3 text-white space-y-2.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Event</span>
          {currentEvent ? (
            <>
              <div className="flex items-center gap-2.5">
                <img 
                  src={currentEvent.poster} 
                  alt="Event Poster" 
                  className="w-11 h-11 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-white uppercase tracking-tight truncate leading-tight">
                    {currentEvent.title}
                  </h4>
                  <p className="text-[10px] text-slate-300 font-semibold mt-0.5 flex items-center gap-1 truncate">
                    <Calendar className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />
                    <span>{currentEvent.date} ({currentEvent.day.slice(0, 3)})</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                    <span>{currentEvent.venue}</span>
                  </p>
                </div>
              </div>

              <button 
                onClick={() => onViewEventDetails(currentEvent)}
                className="w-full py-2 bg-[#2d2282] hover:bg-[#392caa] text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              >
                <span>View Event Page</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-[10px] text-slate-500 font-semibold">No event selected</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
