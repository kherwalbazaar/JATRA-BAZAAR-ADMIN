'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar, { NAV_LABELS } from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardView from '@/components/DashboardView';
import EventsView from '@/components/EventsView';
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

// Modals
import TicketScannerModal from '@/components/TicketScannerModal';
import NewBookingModal from '@/components/NewBookingModal';
import CreateEventModal from '@/components/CreateEventModal';
import AddTicketTypeModal from '@/components/AddTicketTypeModal';
import PrintTicketModal from '@/components/PrintTicketModal';
import EventDetailsModal from '@/components/EventDetailsModal';
import BookingDetailsModal from '@/components/BookingDetailsModal';

import { NavigationTab, BookingItem, EventItem, TicketType } from '@/types';
import { useFirestore } from '@/hooks/useFirestore';
import { UserPlus, Plus } from 'lucide-react';

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
      const validTabs: NavigationTab[] = ['dashboard', 'events', 'tickets-types', 'create-seat', 'diagram', 'counter-booking', 'bookings', 'active-tickets', 'cancelled-tickets', 'cancellation-history', 'refunds', 'tickets', 'scanner-members', 'scan-history', 'online-history', 'payments', 'customers', 'settings', 'logs'];
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
  const [bookingDetailsTarget, setBookingDetailsTarget] = useState<BookingItem | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

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
          sectionTitle={currentTab === 'scan-history' ? 'Scanner' : NAV_LABELS[currentTab] || currentTab}
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
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Create Seat</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {currentEvent
                      ? `Configured for: ${currentEvent.title}`
                      : 'Select an event first from the Events section.'}
                  </p>
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
              <SeatCreateSection
                currentEventId={currentEvent?.id}
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
            />
          )}

          {currentTab === 'customers' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-black text-slate-900">Registered Audience Directory</h2>
              <p className="text-xs text-slate-400 font-semibold -mt-4">Frequent drama audience, phone contacts, and loyalty history.</p>
              <BookingsView
                bookings={bookings}
                onOpenNewBooking={() => setNewBookingOpen(true)}
                onSelectBooking={(b) => setBookingDetailsTarget(b)}
                onPrintTicket={(b) => setPrintTicketTarget(b)}
              />
            </div>
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
