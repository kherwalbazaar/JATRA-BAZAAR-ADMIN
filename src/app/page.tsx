'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar, { NAV_LABELS } from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardView from '@/components/DashboardView';
import EventsView from '@/components/EventsView';
import PartiesView from '@/components/PartiesView';
import TicketTypesView from '@/components/TicketTypesView';
import SeatCreateSection from '@/components/SeatCreateSection';
import BookingsView from '@/components/BookingsView';
import AdminBookings from '@/components/AdminBookings';
import CounterBookingView from '@/components/CounterBookingView';
import DiagramSettingsView from '@/components/DiagramSettingsView';
import ReportsView from '@/components/ReportsView';
import SettingsView from '@/components/SettingsView';
import ScannerMembersView from '@/components/ScannerMembersView';
import ScanHistoryView from '@/components/ScanHistoryView';
import OnlineHistoryView from '@/components/OnlineHistoryView';
import ScannerMemberList from '@/components/ScannerMemberList';
import CreateScannerUserModal from '@/components/CreateScannerUserModal';
import CustomersView from '@/components/customer/CustomersView';

// Modals
import TicketScannerModal from '@/components/TicketScannerModal';
import NewBookingModal from '@/components/NewBookingModal';
import CreateEventModal from '@/components/CreateEventModal';
import AddTicketTypeModal from '@/components/AddTicketTypeModal';
import PrintTicketModal from '@/components/PrintTicketModal';
import EventDetailsModal from '@/components/EventDetailsModal';
import BookingDetailsModal from '@/components/BookingDetailsModal';
import EditBookingModal from '@/components/EditBookingModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

import { NavigationTab, BookingItem, EventItem, TicketType } from '@/types';
import { useFirestore } from '@/hooks/useFirestore';
import { deleteBooking } from '@/lib/firestore';
import { UserPlus, Plus, Building2, MapPin, Calendar, ChevronDown, LayoutGrid, Check } from 'lucide-react';

export default function App() {
  const router = useRouter();
  const {
    events: eventsList,
    currentEvent,
    ticketTypes,
    bookings,
    gates,
    kpis,
    loading,
    isLiveConnected,
    error,
    isOfflineMode,
    isSeeding,
    isSyncing,
    isConnectionLost,
    lastUpdated,
    setCurrentEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    addBooking,
    cancelBooking,
    checkInTicket,
    updateQuota,
    addTicketType,
    updateTicketType,
    deleteTicketType,
    seats,
    createSeatRow,
    deleteSeatRow,
    trimSeatRow,
    seedDatabase,
    retryConnection,
  } = useFirestore();

  // UI State (active tab persisted so Back from edit/details restores the same section)
  const [currentTab, setCurrentTabState] = useState<NavigationTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const setCurrentTab = (tab: NavigationTab) => {
    setCurrentTabState(tab);
    try {
      sessionStorage.setItem('jatra_active_tab', tab);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('jatra_active_tab');
      const validTabs: NavigationTab[] = ['dashboard', 'events', 'parties', 'tickets-types', 'create-seat', 'diagram', 'counter-booking', 'bookings', 'active-tickets', 'cancelled-tickets', 'cancellation-history', 'refunds', 'tickets', 'scanner-members', 'scan-history', 'online-history', 'payments', 'customers', 'settings', 'logs'];
      if (saved && validTabs.includes(saved as NavigationTab)) setCurrentTabState(saved as NavigationTab);
    } catch {
      /* ignore */
    }
  }, []);

  // Sidebar hide/show state persisted across sessions
  useEffect(() => {
    try {
      if (localStorage.getItem('jatra_sidebar_collapsed') === '1') {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('jatra_sidebar_collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Modal Visibility States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [seatFormOpen, setSeatFormOpen] = useState(false);
  const [counterSelection, setCounterSelection] = useState<{ block: string; seats: string[] }[] | null>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [addTicketTypeOpen, setAddTicketTypeOpen] = useState(false);
  const [printTicketTarget, setPrintTicketTarget] = useState<BookingItem | null>(null);
  const [editBookingTarget, setEditBookingTarget] = useState<BookingItem | null>(null);
  const [deleteBookingTarget, setDeleteBookingTarget] = useState<BookingItem | null>(null);

  const handleDeleteBooking = async () => {
    const b = deleteBookingTarget;
    if (!b) return;
    try {
      await deleteBooking({ id: b.id, ticketNumber: b.ticketNumber, eventId: b.eventId, showId: b.showId, block: b.block, seats: b.seats });
    } catch (e) {
      console.error('Failed to delete booking:', e);
    } finally {
      setDeleteBookingTarget(null);
    }
  };
  const [bookingDetailsTarget, setBookingDetailsTarget] = useState<BookingItem | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [seatEventDropdownOpen, setSeatEventDropdownOpen] = useState(false);
  const seatEventDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        seatEventDropdownRef.current &&
        !seatEventDropdownRef.current.contains(event.target as Node)
      ) {
        setSeatEventDropdownOpen(false);
      }
    }
    if (seatEventDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [seatEventDropdownOpen]);

  // Group events by committee for switcher and role-based views
  const eventsByCommittee = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    eventsList.forEach((evt) => {
      const cName = evt.committeeName?.trim() || evt.organizer?.trim() || 'General Committee';
      if (!map.has(cName)) map.set(cName, []);
      map.get(cName)!.push(evt);
    });
    return map;
  }, [eventsList]);

  // Handlers: Add Booking (from POS Counter or Online)
  const handleAddBooking = async (
    newBooking: BookingItem,
    seatGroups?: { block: string; seats: string[] }[]
  ) => {
    if (!currentEvent) return;
    await addBooking(
      {
        ...newBooking,
        eventId: currentEvent.id,
      },
      seatGroups
    );
  };

  // Handlers: Check-in ticket scan
  const handleCheckInTicket = async (ticketNumber: string) => {
    const booking = bookings.find((b) => b.ticketNumber === ticketNumber);
    if (booking) {
      await checkInTicket(booking.id);
    }
  };

  // Handlers: Add Event
  const handleAddEvent = async (newEvent: EventItem) => {
    await addEvent(newEvent);
  };

  // Handlers: Add Ticket Category
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);

  const handleAddTicketType = async (newType: TicketType) => {
    if (!currentEvent) return;
    await addTicketType({
      ...newType,
      eventId: currentEvent.id,
    });
  };

  const handleUpdateTicketType = async (typeId: string, data: Partial<TicketType>) => {
    await updateTicketType(typeId, data);
    setEditingTicketType(null);
  };

  const handleDeleteTicketType = async (type: TicketType) => {
    if (!window.confirm(`Delete ticket category "${type.name}"? This cannot be undone.`)) return;
    await deleteTicketType(type.id);
  };

  // Remove rows from their donor tiers when another category takes them over.
  const handleReassignRows = async (transfers: { fromTypeId: string; rows: string[] }[]) => {
    for (const { fromTypeId, rows } of transfers) {
      const donor = ticketTypes.find((t) => t.id === fromTypeId);
      if (!donor) continue;
      const moved = new Set(rows.map((r) => r.toUpperCase()));
      const remaining = (donor.rows || []).filter((r) => !moved.has(r.toUpperCase()));
      await updateTicketType(fromTypeId, { rows: remaining });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6fc] text-slate-800 antialiased font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        {error && !isLiveConnected && (
          <div className={`border-b px-6 py-2 flex items-center justify-between text-xs ${
            isConnectionLost 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isConnectionLost ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span>{isConnectionLost ? 'Connection lost - Reconnecting...' : `Firebase connection failed (${error})`}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={seedDatabase}
                disabled={isSeeding}
                className={`${
                  isConnectionLost 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                } text-white font-bold px-2.5 py-1 rounded text-xs transition disabled:opacity-60`}
              >
                {isSeeding ? 'Connecting...' : '⚡ Connect to Firebase'}
              </button>
              <button
                onClick={retryConnection}
                className="underline hover:text-red-950 font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Sticky Top Header */}
        <Header
          sectionTitle={NAV_LABELS[currentTab] || currentTab}
          currentEvent={currentEvent}
          eventsList={eventsList}
          onSelectEvent={setCurrentEvent}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenScanner={() => setScannerOpen(true)}
          onOpenNewBooking={() => setNewBookingOpen(true)}
          isLiveConnected={isLiveConnected}
          isLoading={loading}
          isSyncing={isSyncing}
          isConnectionLost={isConnectionLost}
          lastUpdated={lastUpdated}
          onRefresh={retryConnection}
        />

        {/* View Routing */}
        <div className={`flex-1 flex flex-col ${currentTab === 'dashboard' ? 'bg-white' : ''}`}>
          {currentTab === 'dashboard' && (
            <DashboardView
              currentEvent={currentEvent}
              kpis={kpis}
              ticketTypes={ticketTypes}
              gates={gates}
              recentBookings={bookings}
              onNavigateTab={setCurrentTab}
              onOpenCreateEvent={() => router.push('/create-event')}
              onOpenAddTicketType={() => {
                setEditingTicketType(null);
                setAddTicketTypeOpen(true);
              }}
              onOpenNewBooking={() => setNewBookingOpen(true)}
              onOpenScanner={() => setScannerOpen(true)}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
            />
          )}

          {currentTab === 'events' && (
            <EventsView
              eventsList={eventsList}
              currentEvent={currentEvent}
              onSelectEvent={setCurrentEvent}
              onOpenCreateEvent={() => router.push('/create-event')}
              onViewEventDetails={(evt) => router.push(`/event-details?id=${encodeURIComponent(evt.id)}`)}
              onEditEvent={(evt) => {
                router.push(`/edit-event?id=${encodeURIComponent(evt.id)}`);
              }}
              onDeleteEvent={deleteEvent}
            />
          )}

          {currentTab === 'parties' && (
            <PartiesView
              events={eventsList}
              onSelectEvent={setCurrentEvent}
              onNavigateToEvents={() => setCurrentTab('events')}
            />
          )}

          {currentTab === 'tickets-types' && (
            <TicketTypesView
              currentEvent={currentEvent}
              ticketTypes={ticketTypes}
              seats={seats}
              onOpenAddTicketType={() => {
                setEditingTicketType(null);
                setAddTicketTypeOpen(true);
              }}
              onEditTicketType={(type) => {
                setEditingTicketType(type);
                setAddTicketTypeOpen(true);
              }}
              onDeleteTicketType={handleDeleteTicketType}
              onUpdateQuota={updateQuota}
              peopleEntered={kpis.peopleEntered}
            />
          )}

          {currentTab === 'create-seat' && (
            <div className="px-6 pt-6 pb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900 leading-tight">Create Seat</h2>
                  {/* Card-Style Event Switcher Dropdown */}
                  <div className="relative" ref={seatEventDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSeatEventDropdownOpen((prev) => !prev)}
                      className="flex items-center gap-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl px-3 py-1.5 border border-slate-200 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-left max-w-[320px] sm:max-w-[440px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {currentEvent?.date || 'Date TBD'}
                          </span>
                          <span className="text-[11px] font-extrabold text-amber-700 truncate">
                            {currentEvent?.partyName || currentEvent?.organizer || 'Party'}
                          </span>
                        </div>
                        <div className="text-xs font-black text-slate-900 truncate mt-0.5">
                          {currentEvent ? currentEvent.title : 'Select Event & Party'}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                          seatEventDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Card-Style List Dropdown Panel */}
                    {seatEventDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-[min(94vw,460px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[440px] overflow-y-auto">
                        <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Select Event • Party • Story
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {eventsList.length} Shows
                          </span>
                        </div>

                        {eventsList.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                            No events found.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {eventsList.map((evt) => {
                              const isSelected = currentEvent?.id === evt.id;
                              const party = evt.partyName || evt.organizer || 'Party';
                              const committee = evt.committeeName || '';

                              return (
                                <button
                                  key={evt.id}
                                  type="button"
                                  onClick={() => {
                                    setCurrentEvent(evt);
                                    setSeatEventDropdownOpen(false);
                                  }}
                                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                                    isSelected
                                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                                      : 'bg-slate-50/70 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                                  }`}
                                >
                                  {/* Poster / Icon */}
                                  {evt.poster ? (
                                    <img
                                      src={evt.poster}
                                      alt={evt.title}
                                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                                      🎭
                                    </div>
                                  )}

                                  {/* Card Content: Date, Party Name, Story Name */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      {/* Date */}
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                                        <Calendar className="w-3 h-3 text-indigo-600" />
                                        <span>{evt.date || 'Date TBD'}</span>
                                      </span>

                                      {/* Party Name */}
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                                        <span>🎭</span>
                                        <span className="truncate">{party}</span>
                                      </span>

                                      {/* Committee Tag */}
                                      {committee && (
                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded truncate max-w-[130px]">
                                          🏛️ {committee}
                                        </span>
                                      )}
                                    </div>

                                    {/* Story Name */}
                                    <div className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                                      {evt.title}
                                    </div>

                                    {/* Writer & Venue */}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-slate-400 mt-0.5">
                                      {evt.writer && (
                                        <span className="text-indigo-600 font-bold truncate max-w-[140px]">
                                          ✍️ {evt.writer}
                                        </span>
                                      )}
                                      {evt.writer && evt.venue && <span>•</span>}
                                      {evt.venue && (
                                        <span className="truncate">
                                          📍 {evt.venue} {evt.city ? `• ${evt.city}` : ''}
                                        </span>
                                      )}
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
                </div>

                <button
                  type="button"
                  onClick={() => setSeatFormOpen(true)}
                  className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Seat</span>
                </button>
              </div>

              {/* Live Seat Statistics Strip (Compact) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* Total Seats */}
                <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">Total Seats</span>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">{seats.length}</h3>
                  </div>
                </div>

                {/* Available */}
                <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block leading-tight truncate">Available</span>
                    <h3 className="text-sm font-black text-emerald-600 leading-tight">
                      {seats.filter((s) => s.status === 'available').length}
                    </h3>
                  </div>
                </div>

                {/* Booked / Sold */}
                <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider block leading-tight truncate">Booked / Sold</span>
                    <h3 className="text-sm font-black text-rose-600 leading-tight">
                      {seats.filter((s) => s.status === 'booked' || s.status === 'sold').length}
                    </h3>
                  </div>
                </div>

                {/* Reserved */}
                <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block leading-tight truncate">Reserved</span>
                    <h3 className="text-sm font-black text-amber-600 leading-tight">
                      {seats.filter((s) => s.status === 'reserved').length}
                    </h3>
                  </div>
                </div>

                {/* Blocked */}
                <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2 col-span-2 sm:col-span-1">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">Blocked</span>
                    <h3 className="text-sm font-black text-slate-700 leading-tight">
                      {seats.filter((s) => s.status === 'blocked' || s.status === 'locked').length}
                    </h3>
                  </div>
                </div>
              </div>

              <SeatCreateSection
                currentEventId={currentEvent?.id}
                committeeId={currentEvent?.committeeId}
                committeeName={currentEvent?.committeeName}
                seats={seats}
                ticketTypes={ticketTypes}
                isOpen={seatFormOpen}
                onClose={() => setSeatFormOpen(false)}
                onOpenRequest={() => setSeatFormOpen(true)}
                onCreateSeatRow={createSeatRow}
                onDeleteSeatRow={deleteSeatRow}
                onTrimSeatRow={trimSeatRow}
              />
            </div>
          )}

          {currentTab === 'counter-booking' && (
            <CounterBookingView
              currentEvent={currentEvent}
              bookings={bookings}
              ticketTypes={ticketTypes}
              seats={seats}
              onOpenNewBooking={(selection) => {
                setCounterSelection(selection && selection.length ? selection : null);
                setNewBookingOpen(true);
              }}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onCancelBooking={async (b) => {
                try {
                  await cancelBooking(b);
                } catch (err) {
                  console.error('Cancel booking failed:', err);
                  window.alert('Failed to cancel booking. Please try again.');
                }
              }}
            />
          )}

          {currentTab === 'diagram' && <DiagramSettingsView seats={seats} />}

          {currentTab === 'bookings' && (
            <AdminBookings
              currentShowId={currentEvent?.id}
              initialBookings={bookings}
              onOpenNewBooking={() => setCurrentTab('counter-booking')}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onEditBooking={(b) => setEditBookingTarget(b)}
              onDeleteBooking={(b) => setDeleteBookingTarget(b)}
            />
          )}

          {currentTab === 'active-tickets' && (
            <AdminBookings
              preset="active"
              currentShowId={currentEvent?.id}
              initialBookings={bookings}
              onOpenNewBooking={() => setCurrentTab('counter-booking')}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onEditBooking={(b) => setEditBookingTarget(b)}
              onDeleteBooking={(b) => setDeleteBookingTarget(b)}
            />
          )}

          {currentTab === 'cancelled-tickets' && (
            <AdminBookings
              preset="cancelled"
              currentShowId={currentEvent?.id}
              initialBookings={bookings}
              onOpenNewBooking={() => setCurrentTab('counter-booking')}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onEditBooking={(b) => setEditBookingTarget(b)}
              onDeleteBooking={(b) => setDeleteBookingTarget(b)}
            />
          )}

          {currentTab === 'cancellation-history' && (
            <AdminBookings
              preset="cancellation-history"
              currentShowId={currentEvent?.id}
              initialBookings={bookings}
              onOpenNewBooking={() => setCurrentTab('counter-booking')}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onEditBooking={(b) => setEditBookingTarget(b)}
              onDeleteBooking={(b) => setDeleteBookingTarget(b)}
            />
          )}

          {currentTab === 'refunds' && (
            <AdminBookings
              preset="refunds"
              currentShowId={currentEvent?.id}
              initialBookings={bookings}
              onOpenNewBooking={() => setCurrentTab('counter-booking')}
              onSelectBooking={(b) => setBookingDetailsTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
              onEditBooking={(b) => setEditBookingTarget(b)}
              onDeleteBooking={(b) => setDeleteBookingTarget(b)}
            />
          )}

          {currentTab === 'tickets' && (
            <div className="p-6 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-end mb-5">
                <button
                  onClick={() => setCreateUserOpen(true)}
                  className="bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create User
                </button>
              </div>

              <ScannerMemberList />
            </div>
          )}

          {currentTab === 'scanner-members' && <ScannerMembersView />}

          {currentTab === 'scan-history' && <ScanHistoryView />}

          {currentTab === 'online-history' && (
            <OnlineHistoryView events={eventsList} ticketTypes={ticketTypes} />
          )}

          {currentTab === 'payments' && (
            <ReportsView
              currentEvent={currentEvent}
              kpis={kpis}
              ticketTypes={ticketTypes}
              bookings={bookings}
              seats={seats}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView />
          )}

          {(currentTab === 'settings' || currentTab === 'logs') && (
            <SettingsView currentEvent={currentEvent} />
          )}
        </div>
      </div>

      {/* Global Interactive Modals */}
      <TicketScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        bookings={bookings}
        currentEvent={currentEvent}
        onCheckInTicket={handleCheckInTicket}
      />

      <NewBookingModal
        isOpen={newBookingOpen}
        onClose={() => {
          setNewBookingOpen(false);
          setCounterSelection(null);
        }}
        currentEvent={currentEvent}
        ticketTypes={ticketTypes}
        seats={seats}
        counterSelection={counterSelection}
        onAddBooking={handleAddBooking}
        onBooked={() => setCounterSelection(null)}
        onPrintDirect={(b) => setPrintTicketTarget(b)}
      />

      <CreateEventModal
        isOpen={createEventOpen}
        onClose={() => {
          setCreateEventOpen(false);
          setEditingEvent(null);
        }}
        onAddEvent={handleAddEvent}
        onUpdateEvent={updateEvent}
        editingEvent={editingEvent}
      />

      <AddTicketTypeModal
        isOpen={addTicketTypeOpen}
        onClose={() => {
          setAddTicketTypeOpen(false);
          setEditingTicketType(null);
        }}
        onAddTicketType={handleAddTicketType}
        onUpdateTicketType={handleUpdateTicketType}
        editingType={editingTicketType}
        committeeNames={Array.from(
          new Set(eventsList.map((e) => (e.committeeName || '').trim()).filter(Boolean))
        )}
        seats={seats}
        existingTypes={ticketTypes}
        onReassignRows={handleReassignRows}
      />

      <BookingDetailsModal
        isOpen={!!bookingDetailsTarget}
        booking={bookingDetailsTarget}
        onClose={() => setBookingDetailsTarget(null)}
        onPrintBooking={(b) => setPrintTicketTarget(b)}
      />

      <PrintTicketModal
        booking={printTicketTarget}
        currentEvent={currentEvent}
        onClose={() => setPrintTicketTarget(null)}
      />

      <EditBookingModal
        isOpen={!!editBookingTarget}
        booking={editBookingTarget}
        onClose={() => setEditBookingTarget(null)}
        onSaved={() => setEditBookingTarget(null)}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteBookingTarget}
        booking={deleteBookingTarget}
        onClose={() => setDeleteBookingTarget(null)}
        onConfirm={handleDeleteBooking}
      />

      <EventDetailsModal
        event={selectedEventForModal}
        onClose={() => setSelectedEventForModal(null)}
      />

      <CreateScannerUserModal
        isOpen={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        gates={gates}
      />
    </div>
  );
}
