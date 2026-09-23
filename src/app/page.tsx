'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardView from '@/components/DashboardView';
import EventsView from '@/components/EventsView';
import TicketTypesView from '@/components/TicketTypesView';
import BookingsView from '@/components/BookingsView';
import GateManagementView from '@/components/GateManagementView';
import CounterManagementView from '@/components/CounterManagementView';
import ReportsView from '@/components/ReportsView';
import SettingsView from '@/components/SettingsView';

// Modals
import TicketScannerModal from '@/components/TicketScannerModal';
import NewBookingModal from '@/components/NewBookingModal';
import CreateEventModal from '@/components/CreateEventModal';
import AddTicketTypeModal from '@/components/AddTicketTypeModal';
import PrintTicketModal from '@/components/PrintTicketModal';
import EventDetailsModal from '@/components/EventDetailsModal';

import { NavigationTab, BookingItem, EventItem, TicketType } from '@/types';
import { useFirestore } from '@/hooks/useFirestore';

export default function App() {
  const router = useRouter();
  const {
    events: eventsList,
    currentEvent,
    ticketTypes,
    bookings,
    gates,
    counters,
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
    checkInTicket,
    updateQuota,
    incrementGate,
    decrementGate,
    resetGate,
    addTicketType,
    seedDatabase,
    retryConnection,
  } = useFirestore();

  // UI State
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Visibility States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [addTicketTypeOpen, setAddTicketTypeOpen] = useState(false);
  const [printTicketTarget, setPrintTicketTarget] = useState<BookingItem | null>(null);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  // Handlers: Add Booking (from POS Counter or Online)
  const handleAddBooking = async (newBooking: BookingItem) => {
    if (!currentEvent) return;
    await addBooking({
      ...newBooking,
      eventId: currentEvent.id,
    });
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
  const handleAddTicketType = async (newType: TicketType) => {
    if (!currentEvent) return;
    await addTicketType({
      ...newType,
      eventId: currentEvent.id,
    });
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6fc] text-slate-800 antialiased font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentEvent={currentEvent}
        onViewEventDetails={(evt) => setSelectedEventForModal(evt)}
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
        <div className="flex-1">
          {currentTab === 'dashboard' && (
            <DashboardView
              currentEvent={currentEvent}
              kpis={kpis}
              ticketTypes={ticketTypes}
              gates={gates}
              recentBookings={bookings}
              onNavigateTab={setCurrentTab}
              onOpenCreateEvent={() => router.push('/create-event')}
              onOpenAddTicketType={() => setAddTicketTypeOpen(true)}
              onOpenNewBooking={() => setNewBookingOpen(true)}
              onOpenScanner={() => setScannerOpen(true)}
              onSelectBooking={(b) => setPrintTicketTarget(b)}
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
              onOpenAddTicketType={() => setAddTicketTypeOpen(true)}
              onUpdateQuota={updateQuota}
            />
          )}

          {currentTab === 'bookings' && (
            <BookingsView
              bookings={bookings}
              onOpenNewBooking={() => setNewBookingOpen(true)}
              onSelectBooking={(b) => setPrintTicketTarget(b)}
              onPrintTicket={(b) => setPrintTicketTarget(b)}
            />
          )}

          {currentTab === 'tickets' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Ticket Validation & Gate Scanning</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Scan attendee QR codes to verify authenticity and admit at gate turnstiles.</p>
                </div>
                <button
                  onClick={() => setScannerOpen(true)}
                  className="bg-[#4f39f6] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
                >
                  Open QR Scanner Camera
                </button>
              </div>

              <BookingsView
                bookings={bookings}
                onOpenNewBooking={() => setNewBookingOpen(true)}
                onSelectBooking={(b) => setPrintTicketTarget(b)}
                onPrintTicket={(b) => setPrintTicketTarget(b)}
              />
            </div>
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
                onSelectBooking={(b) => setPrintTicketTarget(b)}
                onPrintTicket={(b) => setPrintTicketTarget(b)}
              />
            </div>
          )}

          {currentTab === 'counters' && (
            <CounterManagementView
              currentEvent={currentEvent}
              counters={counters}
              onOpenNewBooking={() => setNewBookingOpen(true)}
            />
          )}

          {currentTab === 'gates' && (
            <GateManagementView
              currentEvent={currentEvent}
              gates={gates}
              onIncrementGate={incrementGate}
              onDecrementGate={decrementGate}
              onResetGate={resetGate}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              currentEvent={currentEvent}
              kpis={kpis}
              ticketTypes={ticketTypes}
            />
          )}

          {(currentTab === 'settings' || currentTab === 'users' || currentTab === 'logs' || currentTab === 'support' || currentTab === 'marketing') && (
            <SettingsView currentEvent={currentEvent} />
          )}
        </div>
      </div>

      {/* Global Interactive Modals */}
      <TicketScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        bookings={bookings}
        onCheckInTicket={handleCheckInTicket}
      />

      <NewBookingModal
        isOpen={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        currentEvent={currentEvent}
        ticketTypes={ticketTypes}
        onAddBooking={handleAddBooking}
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
        onClose={() => setAddTicketTypeOpen(false)}
        onAddTicketType={handleAddTicketType}
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
    </div>
  );
}
