'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  LayoutGrid, 
  Ticket, 
  CreditCard, 
  Users, 
  Settings, 
  FileText, 
  Sparkles,
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
  RotateCcw
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
  events: 'Events',
  'tickets-types': 'Ticket Types',
  'create-seat': 'Create Seat',
  diagram: 'Diagram',
  'counter-booking': 'Counter Booking',
  'booking-management': 'Booking Management',
  bookings: 'All Bookings',
  'active-tickets': 'Active Tickets',
  'cancelled-tickets': 'Cancelled Tickets',
  'cancellation-history': 'Cancellation History',
  refunds: 'Refund Management',
  tickets: 'Scanner',
  'scan-history': 'Scan History',
  'online-history': 'Online Bookings',
  payments: 'Payments',
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

export default function Sidebar({
  currentTab,
  onTabChange,
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
    { id: 'settings', label: NAV_LABELS.settings, Icon: Settings },
    { id: 'logs', label: NAV_LABELS.logs, Icon: FileText },
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

  // Expandable "Booking Management" group — inserted right after Counter Booking.
  const renderBookingGroup = () => (
    <div className={bookingActive ? 'bg-white/[0.04]' : ''}>
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
        className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} transition-all ${
          collapsed ? '' : 'text-left'
        } ${
          bookingActive
            ? 'text-white font-bold'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`}
      >
        <div className={`${bookingActive ? 'text-white' : 'text-slate-400'} flex-shrink-0`}>
          <BookOpen className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
        </div>
        {!collapsed && (
          <>
            <span className="truncate flex-1">{NAV_LABELS['booking-management']}</span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${bookingsOpen ? 'rotate-90' : ''}`}
            />
          </>
        )}
      </button>

      {!collapsed && bookingsOpen && (
        <div className="bg-black/25 divide-y divide-indigo-400/10 border-t border-indigo-400/10">
          {bookingChildren.map((child) => {
            const isActive = currentTab === child.id;
            const { Icon } = child;
            return (
              <button
                key={child.id}
                onClick={() => onTabChange(child.id)}
                className={`w-full flex items-center gap-3 pl-9 pr-3 py-2 text-left text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#4f39f6] text-white font-bold shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={isActive ? 'text-white' : 'text-slate-500'}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{child.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-64'} relative bg-[#0f1430] text-slate-300 flex flex-col flex-shrink-0 z-30 select-none border-r border-indigo-950/60 h-screen transition-[width] duration-300 ease-in-out`}>
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

      <div className="flex flex-col flex-1 min-h-0">
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
                <React.Fragment key={item.id}>
                  <button
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
                  {item.id === 'counter-booking' && renderBookingGroup()}
                </React.Fragment>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}
