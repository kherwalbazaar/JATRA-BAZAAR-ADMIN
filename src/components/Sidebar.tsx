'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  LayoutGrid, 
  CreditCard, 
  Users, 
  Settings, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  History, 
  Armchair, 
  ShoppingCart, 
  Globe, 
  Layers, 
  BookOpen, 
  ClipboardList, 
  CheckCircle2, 
  Ban, 
  RotateCcw,
  QrCode
} from 'lucide-react';
import { NavigationTab } from '@/types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const NAV_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Event Management',
  'tickets-types': 'Ticket Types & Pricing',
  'create-seat': 'Seat Management',
  diagram: 'Seating Layout',
  'counter-booking': 'Counter Sales',
  'booking-management': 'Booking Management',
  bookings: 'All Bookings',
  'active-tickets': 'Active Tickets',
  'cancelled-tickets': 'Cancelled Tickets',
  'cancellation-history': 'Cancellation History',
  refunds: 'Refund Management',
  tickets: 'Ticket Scanner',
  'scanner-members': 'Scanner Members',
  'scan-history': 'Scan History',
  'online-history': 'Online Bookings',
  payments: 'Payments & Collections',
  customers: 'Customers',
  settings: 'Settings',
  logs: 'System Logs',
};

const BOOKING_TABS: NavigationTab[] = [
  'bookings',
  'active-tickets',
  'cancelled-tickets',
  'cancellation-history',
  'refunds',
];

interface NavItem {
  id: NavigationTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  isBookingTrigger?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar({
  currentTab,
  onTabChange,
  collapsed,
  onToggleCollapse
}: SidebarProps) {
  const sections: NavSection[] = [
    {
      title: 'Core',
      items: [
        { id: 'dashboard', label: NAV_LABELS.dashboard, Icon: LayoutDashboard },
        { id: 'events', label: NAV_LABELS.events, Icon: CalendarDays },
      ],
    },
    {
      title: 'Venue & Seating',
      items: [
        { id: 'tickets-types', label: NAV_LABELS['tickets-types'], Icon: LayoutGrid },
        { id: 'create-seat', label: NAV_LABELS['create-seat'], Icon: Armchair },
        { id: 'diagram', label: NAV_LABELS.diagram, Icon: Layers },
      ],
    },
    {
      title: 'Sales & Bookings',
      items: [
        { id: 'counter-booking', label: NAV_LABELS['counter-booking'], Icon: ShoppingCart },
        { id: 'bookings', label: NAV_LABELS['booking-management'], Icon: BookOpen, isBookingTrigger: true },
        { id: 'online-history', label: NAV_LABELS['online-history'], Icon: Globe },
      ],
    },
    {
      title: 'Verification',
      items: [
        { id: 'tickets', label: NAV_LABELS.tickets, Icon: QrCode },
        { id: 'scan-history', label: NAV_LABELS['scan-history'], Icon: History },
      ],
    },
    {
      title: 'Finance & Audience',
      items: [
        { id: 'payments', label: NAV_LABELS.payments, Icon: CreditCard },
        { id: 'customers', label: NAV_LABELS.customers, Icon: Users },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { id: 'settings', label: NAV_LABELS.settings, Icon: Settings },
        { id: 'logs', label: NAV_LABELS.logs, Icon: FileText },
      ],
    },
  ];

  const bookingChildren: {
    id: NavigationTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'bookings', label: NAV_LABELS.bookings, Icon: ClipboardList },
    { id: 'active-tickets', label: NAV_LABELS['active-tickets'], Icon: CheckCircle2 },
    { id: 'cancelled-tickets', label: NAV_LABELS['cancelled-tickets'], Icon: Ban },
    { id: 'cancellation-history', label: NAV_LABELS['cancellation-history'], Icon: History },
    { id: 'refunds', label: NAV_LABELS.refunds, Icon: RotateCcw },
  ];

  const bookingActive = BOOKING_TABS.includes(currentTab);
  const [bookingsOpenState, setBookingsOpenState] = React.useState<boolean | null>(null);
  const bookingsOpen = bookingsOpenState ?? bookingActive;

  const renderBookingGroup = () => (
    <div key="booking-management-group" className="w-full">
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            onToggleCollapse();
            setBookingsOpenState(true);
          } else {
            setBookingsOpenState(!bookingsOpen);
          }
        }}
        title={collapsed ? NAV_LABELS['booking-management'] : undefined}
        aria-expanded={collapsed ? undefined : bookingsOpen}
        className={`w-full flex items-center ${
          collapsed
            ? 'w-10 h-10 mx-auto justify-center rounded-xl'
            : 'gap-3 px-3 py-2.5 rounded-xl text-left'
        } transition-all duration-150 group ${
          bookingActive
            ? 'bg-white/[0.08] text-white font-bold ring-1 ring-white/10'
            : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
        }`}
      >
        <div
          className={`${
            bookingActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-300'
          } transition-colors flex-shrink-0`}
        >
          <BookOpen className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
        </div>
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-xs tracking-tight">
              {NAV_LABELS['booking-management']}
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                bookingsOpen ? 'rotate-90 text-indigo-400' : ''
              }`}
            />
          </>
        )}
      </button>

      {!collapsed && bookingsOpen && (
        <div className="mt-1 ml-4 pl-2.5 border-l border-indigo-500/25 space-y-0.5">
          {bookingChildren.map((child) => {
            const isActive = currentTab === child.id;
            const { Icon } = child;
            return (
              <button
                key={child.id}
                onClick={() => onTabChange(child.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold transition-all duration-150 group ${
                  isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <div className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{child.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <aside
      className={`${
        collapsed ? 'w-[70px]' : 'w-64'
      } relative bg-[#0c102a] text-slate-300 flex flex-col flex-shrink-0 z-30 select-none border-r border-indigo-950/70 h-screen transition-[width] duration-300 ease-in-out`}
    >
      {/* Collapse / Expand Toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#181e45] border border-indigo-500/40 text-slate-300 hover:text-white hover:bg-indigo-600 hover:border-indigo-400 shadow-md flex items-center justify-center z-40 transition-all duration-150"
      >
        <ChevronLeft
          className={`w-3.5 h-3.5 transition-transform duration-300 ${
            collapsed ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Logo Header */}
        <div
          className={`${
            collapsed ? 'px-2 py-4' : 'px-4 py-4'
          } border-b border-indigo-950/80 bg-[#0d122c]/60`}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 p-0.5 shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-amber-400/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ic_launcher.png"
                alt="Jatra Bazaar"
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <h1 className="text-sm font-black text-white tracking-wider flex items-center gap-1">
                  <span className="text-amber-400">JATRA</span>
                  <span>BAZAAR</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-indigo-300/80 font-bold uppercase tracking-wider">
                    Admin Portal
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu List */}
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            collapsed ? 'px-2 py-3' : 'px-3 py-3'
          } space-y-4 text-xs font-semibold scrollbar-thin scrollbar-thumb-indigo-950/60`}
        >
          {sections.map((section, idx) => (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-300/40 select-none">
                  {section.title}
                </div>
              ) : idx > 0 ? (
                <div className="my-2 mx-2 border-t border-white/[0.08]" />
              ) : null}

              <div className="space-y-1">
                {section.items.map((item) => {
                  if (item.isBookingTrigger) {
                    return renderBookingGroup();
                  }

                  const isActive = currentTab === item.id;
                  const { Icon } = item;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center ${
                        collapsed
                          ? 'w-10 h-10 mx-auto justify-center rounded-xl'
                          : 'gap-3 px-3 py-2.5 rounded-xl text-left'
                      } transition-all duration-150 group ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-md shadow-indigo-600/25 ring-1 ring-white/10'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <div
                        className={`${
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-indigo-300'
                        } transition-colors flex-shrink-0`}
                      >
                        <Icon className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
                      </div>
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-xs tracking-tight">
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400/50 flex-shrink-0" />
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Status Footer */}
        <div
          className={`p-3 border-t border-indigo-950/80 bg-[#0a0e24] ${
            collapsed ? 'flex justify-center' : ''
          }`}
        >
          {collapsed ? (
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50 animate-pulse"
              title="System Online"
            />
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50 animate-pulse" />
                <span className="text-slate-300 text-[10px] font-bold">System Online</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-400/70 font-mono">v1.2</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
