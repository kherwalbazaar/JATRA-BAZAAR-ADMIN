'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  LayoutGrid, 
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
  ChevronLeft,
  History,
  Armchair,
  ShoppingCart,
  Globe,
  Layers
} from 'lucide-react';
import { NavigationTab, EventItem } from '@/types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  currentEvent: EventItem | null;
  onViewEventDetails: (event: EventItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const NAV_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Events',
  'tickets-types': 'Ticket Types',
  'create-seat': 'Create Seat',
  diagram: 'Diagram',
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
  onViewEventDetails,
  collapsed,
  onToggleCollapse
}: SidebarProps) {
  const navItems: { id: NavigationTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: NAV_LABELS.dashboard, Icon: LayoutDashboard },
    { id: 'events', label: NAV_LABELS.events, Icon: CalendarDays },
    { id: 'tickets-types', label: NAV_LABELS['tickets-types'], Icon: LayoutGrid },
    { id: 'create-seat', label: NAV_LABELS['create-seat'], Icon: Armchair },
    { id: 'diagram', label: NAV_LABELS.diagram, Icon: Layers },
    { id: 'counter-booking', label: NAV_LABELS['counter-booking'], Icon: ShoppingCart },
    { id: 'tickets', label: NAV_LABELS.tickets, Icon: Ticket },
    { id: 'scan-history', label: NAV_LABELS['scan-history'], Icon: History },
    { id: 'online-history', label: NAV_LABELS['online-history'], Icon: Globe },
    { id: 'payments', label: NAV_LABELS.payments, Icon: CreditCard },
    { id: 'customers', label: NAV_LABELS.customers, Icon: Users },
    { id: 'counters', label: NAV_LABELS.counters, Icon: Store },
    { id: 'gates', label: NAV_LABELS.gates, Icon: DoorOpen },
    { id: 'reports', label: NAV_LABELS.reports, Icon: TrendingUp },
    { id: 'marketing', label: NAV_LABELS.marketing, Icon: Megaphone },
    { id: 'settings', label: NAV_LABELS.settings, Icon: Settings },
    { id: 'users', label: NAV_LABELS.users, Icon: ShieldCheck },
    { id: 'logs', label: NAV_LABELS.logs, Icon: FileText },
    { id: 'support', label: NAV_LABELS.support, Icon: HelpCircle },
  ];

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-64'} relative bg-[#0f1430] text-slate-300 flex flex-col justify-between flex-shrink-0 z-30 select-none border-r border-indigo-950/60 min-h-screen transition-[width] duration-300 ease-in-out`}>
      {/* Collapse / Expand Toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand menu' : 'Hide menu'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-[#181e45] border border-indigo-500/50 text-slate-400 hover:text-white hover:border-indigo-400 shadow-md flex items-center justify-center z-40 transition-colors"
      >
        <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Logo Header */}
        <div className={`${collapsed ? 'px-3 py-4' : 'px-5 py-5'} border-b border-indigo-900/40`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-[#181d45] rounded-full flex items-center justify-center text-amber-400 text-xl font-black">
                🎭
              </div>
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <h1 className="text-base font-black text-white tracking-wider flex items-center gap-1">
                  <span className="text-amber-400">JATRA</span>
                  <span>BAZAAR</span>
                </h1>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Admin Panel</p>
              </div>
            )}
          </div>

          {/* Admin Badge Pill */}
          {!collapsed && (
            <div className="mt-3.5 flex justify-center">
              <span className="w-full text-center bg-[#292275] border border-indigo-500/30 text-indigo-200 text-[10px] font-black tracking-widest uppercase py-1 px-3 rounded-md shadow-xs flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Admin Panel</span>
              </span>
            </div>
          )}
        </div>

        {/* Navigation Menu List */}
        <nav className={`${collapsed ? 'px-2 py-4' : 'px-3 py-4'} text-xs font-semibold`}>
          <div className="border border-indigo-400/20 rounded-lg overflow-hidden divide-y divide-indigo-400/15">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const { Icon } = item;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-none transition-all ${
                    collapsed ? '' : 'text-left'
                  } ${
                    isActive
                      ? 'bg-[#4f39f6] text-white font-bold shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className={`${isActive ? 'text-white' : 'text-slate-400'} flex-shrink-0`}>
                    <Icon className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
                  </div>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Sidebar Bottom: Current Event Box */}
      <div className="p-3 border-t border-indigo-950/60">
        {collapsed ? (
          <div className="bg-[#181e42] border border-indigo-800/50 rounded-2xl p-2 flex justify-center">
            {currentEvent ? (
              <button
                type="button"
                onClick={() => onViewEventDetails(currentEvent)}
                title={`${currentEvent.title} - View Event Page`}
                className="transition active:scale-95"
              >
                <img
                  src={currentEvent.poster}
                  alt={currentEvent.title}
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/10"
                />
              </button>
            ) : (
              <div
                title="No event selected"
                className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center"
              >
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </aside>
  );
}
