'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  MoreVertical,
  Trash2,
  Armchair,
  Star,
  IndianRupee,
  ListChecks,
  LayoutGrid,
  Layers,
  Download
} from 'lucide-react';
import { BookingItem, EventItem, TicketType, Seat } from '@/types';
import StageDiagram, { buildSeatStats } from '@/components/StageDiagram';
import { useBlockCategories } from '@/hooks/useBlockCategories';

interface CounterBookingViewProps {
  currentEvent: EventItem | null;
  bookings: BookingItem[];
  ticketTypes: TicketType[];
  seats: Seat[];
  onOpenNewBooking: (selection?: { block: string; seats: string[] }[]) => void;
  onPrintTicket: (booking: BookingItem) => void;
  onCancelBooking: (booking: BookingItem) => void;
}

export default function CounterBookingView({
  currentEvent,
  bookings,
  ticketTypes,
  seats,
  onOpenNewBooking,
  onPrintTicket,
  onCancelBooking
}: CounterBookingViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'checked-in' | 'cancelled'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [view, setView] = useState<'seats' | 'history'>('seats');
  const [showStage, setShowStage] = useState(true);
  const { blocks: blockCategories, labels: blockLabels, channelLabels, disabledBlocks } = useBlockCategories();
  const seatStats = useMemo(() => buildSeatStats(seats), [seats]);

  // Filter bookings for counter sales
  const counterBookings = bookings.filter(booking => booking.source === 'Counter');

  // Shared history — online + counter bookings (legacy online bookings without
  // eventId are included too so the unified record list is complete).
  const historyBookings = currentEvent
    ? bookings.filter(b => !b.eventId || b.eventId === currentEvent.id)
    : bookings;

  // Apply filters
  const filteredBookings = historyBookings.filter(booking => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      booking.customerName?.toLowerCase().includes(q) ||
      booking.ticketNumber?.toLowerCase().includes(q) ||
      booking.customerPhone?.toLowerCase().includes(q) ||
      booking.ticketTypeName?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'confirmed' && booking.status === 'Confirmed') ||
      (statusFilter === 'checked-in' && booking.status === 'Checked-in') ||
      (statusFilter === 'cancelled' && (booking.status === 'Refunded' || booking.status === 'Cancelled'));

    return matchesSearch && matchesStatus;
  });

  // Seats the customer app has reserved while a user is selecting/paying.
  // Fresh holds (10 min TTL) block the counter; stale ones sellable again.
  const RESERVE_TTL_MS = 10 * 60 * 1000;
  const isSeatReserved = (seat: Seat): boolean => {
    if (String(seat.status || '').toLowerCase() !== 'reserved') return false;
    const at = Date.parse(seat.reservedAt || '');
    if (Number.isNaN(at)) return false;
    return Date.now() - at < RESERVE_TTL_MS;
  };

  // Calculate stats (all bookings for the current event, not just counter)
  const eventBookings = currentEvent
    ? bookings.filter(b => b.eventId === currentEvent.id)
    : bookings;
  const activeBookings = eventBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Refunded');
  const totalBookings = seats.filter(seat => seat.status === 'booked').length;
  const reservedSeatCount = seats.filter(seat => isSeatReserved(seat)).length;
  const totalSeatCount = seats.length;
  const availableSeatCount = Math.max(0, totalSeatCount - totalBookings - reservedSeatCount);
  const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Venue Map Blocks - only show blocks that have seats in the database
  const venueBlocks = useMemo(() => {
    const blocksWithSeats = new Set(seats.map(seat => seat.blockId));
    return blocksWithSeats;
  }, [seats]);

  // Horizontal block-category tabs — ALL known blocks (configured categories
  // plus any block that only exists as seats), with booked/total counts.
  const blockChips = useMemo(() => {
    const map = new Map<string, { total: number; booked: number }>();
    blockCategories.forEach((b) => map.set(b.id, { total: 0, booked: 0 }));
    seats.forEach((s) => {
      const entry = map.get(s.blockId) || { total: 0, booked: 0 };
      entry.total += 1;
      if (s.status === 'booked') entry.booked += 1;
      map.set(s.blockId, entry);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [seats, blockCategories]);

  // Find the ticket type that owns a seat (by block + row coverage).
  const getTicketTypeForSeat = (seat: Seat): TicketType | undefined => {
    return ticketTypes.find(tt => {
      const blocks = (tt.blocks || []).map(b => b.trim().toUpperCase()).filter(Boolean);
      const blocksMatch = blocks.length === 0 || blocks.includes('ALL') || blocks.includes(seat.blockId.trim().toUpperCase());
      const rows = (tt.rows || []).map(r => r.trim().toUpperCase()).filter(Boolean);
      const baseRow = seat.rowId.replace(/[0-9]/g, '').toUpperCase();
      const rowsMatch = rows.length === 0 || rows.includes('ALL') || rows.includes(seat.rowId.toUpperCase()) || rows.includes(baseRow);
      return blocksMatch && rowsMatch;
    });
  };

  // Seat value always follows the owning ticket type's current price —
  // stored seat.price can be stale after a tier price change.
  const seatPrice = (seat: Seat): number => {
    const tt = getTicketTypeForSeat(seat);
    if (tt && Number(tt.price) > 0) return Number(tt.price);
    return Number(seat.price) || 0;
  };

  // Group a block's seats by ticket type — each group keeps rows sorted.
  const getBlockSeatsByTicketType = (blockId: string) => {
    const blockSeats = seats.filter(seat => seat.blockId === blockId);
    const groups = new Map<string, { type?: TicketType; seatsByRow: Map<string, Seat[]> }>();
    blockSeats.forEach(seat => {
      const tt = getTicketTypeForSeat(seat);
      const key = tt?.id || '__standard__';
      if (!groups.has(key)) groups.set(key, { type: tt, seatsByRow: new Map() });
      const g = groups.get(key)!;
      if (!g.seatsByRow.has(seat.rowId)) g.seatsByRow.set(seat.rowId, []);
      g.seatsByRow.get(seat.rowId)!.push(seat);
    });
    groups.forEach(g => {
      g.seatsByRow.forEach(list => list.sort((a, b) => a.seatNumber - b.seatNumber));
    });
    return groups;
  };

  // Handle block selection
  const handleBlockSelect = (blockId: string) => {
    setActiveBlock(blockId);
    setSelectedSeats([]);
  };

  // Map diagram block labels to blocks that actually have seats (C1 → C, etc.)
  const handleDiagramBlockSelect = (diagramBlock: string) => {
    let blockId = diagramBlock;
    if (!venueBlocks.has(blockId) && diagramBlock.endsWith('1') && venueBlocks.has(diagramBlock[0])) {
      blockId = diagramBlock[0];
    }
    handleBlockSelect(blockId);
  };

  // Handle seat selection — booked OR freshly reserved (online hold) are blocked
  const handleSeatToggle = (seatId: string, isBlocked: boolean) => {
    if (isBlocked) return;
    setSelectedSeats(prev =>
      prev.includes(seatId)
        ? prev.filter(s => s !== seatId)
        : [...prev, seatId]
    );
  };

  // Get selected seat objects for booking
  const getSelectedSeatObjects = () => {
    return seats.filter(seat => selectedSeats.includes(seat.id));
  };

  // Live total of the current selection (ticket-type price per seat).
  const selectedTotal = getSelectedSeatObjects().reduce(
    (sum, s) => sum + seatPrice(s),
    0
  );

  // Hand the picked seats to the booking modal — addBooking claims them atomically.
  const handleBookSelected = () => {
    const groups = new Map<string, string[]>();
    getSelectedSeatObjects().forEach((s) => {
      const block = (s.blockId || activeBlock || '').trim().toUpperCase();
      if (!block) return;
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block)!.push(s.id);
    });
    const selection = Array.from(groups.entries()).map(([block, seatsInBlock]) => ({ block, seats: seatsInBlock }));
    if (!selection.length) return;
    onOpenNewBooking(selection);
    setSelectedSeats([]);
  };

  const handleCancelBooking = (booking: BookingItem) => {
    setOpenMenuId(null);
    const ok = window.confirm(
      `Cancel booking ${booking.ticketNumber} for ${booking.customerName}? This will release the booked seats.`
    );
    if (ok) onCancelBooking(booking);
  };

  const handleExportCSV = () => {
    const header = ['Ticket #', 'Customer', 'Phone', 'Ticket Type', 'Qty', 'Seats', 'Amount', 'Payment', 'Status', 'Date'];
    const rows = filteredBookings.map(b => [
      b.ticketNumber || '',
      b.customerName || '',
      b.customerPhone || '',
      b.ticketTypeName || '',
      String(b.quantity || 0),
      (b.seats || []).join(' '),
      String(b.amount || 0),
      b.paymentMethod || '',
      b.status || '',
      b.date || ''
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counter_bookings_${currentEvent?.title || 'event'}_${new Date().toISOString().slice(0, 10)}.csv`
      .replace(/\s+/g, '_')
      .toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTicketTypeName = (ticketTypeId: string, ticketTypeName?: string) => {
    const ticketType = ticketTypes.find(t => t.id === ticketTypeId);
    return ticketType?.name || ticketTypeName || 'Standard';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Confirmed': { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
      'Checked-in': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Checked-in' },
      'Refunded': { bg: 'bg-red-100', text: 'text-red-700', label: 'Refunded' },
      'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['Confirmed'];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6 flex-1 flex flex-col min-h-0">
      {/* Flush top block: stats strip + toolbar + stage diagram with no gap */}
      <div className="-mx-6 -mt-6 -mb-6 flex-1 flex flex-col min-h-0">
      {/* Stats Bar — single compact line, flush to top/left/right */}
      <div className="bg-pink-100 border-b border-pink-200 shadow-xs px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Booking</span>
          <span className="text-sm font-black text-slate-900 bg-white px-2 py-0.5 rounded-md">{totalBookings}</span>
        </div>
        <div className="w-px h-4 bg-pink-300 flex-shrink-0" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Seat</span>
          <span className="text-sm font-black text-slate-900 bg-white px-2 py-0.5 rounded-md">{totalSeatCount}</span>
        </div>
        <div className="w-px h-4 bg-pink-300 flex-shrink-0" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</span>
          <span className="text-sm font-black text-emerald-600 bg-white px-2 py-0.5 rounded-md">{availableSeatCount}</span>
        </div>
        <div className="w-px h-4 bg-pink-300 flex-shrink-0" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
          <span className="text-sm font-black text-green-600 bg-white px-2 py-0.5 rounded-md">₹{totalRevenue.toLocaleString()}</span>
        </div>
        <div className="w-px h-4 bg-pink-300 flex-shrink-0" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Counter Sales</span>
          <span className="text-sm font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md">{counterBookings.length}</span>
        </div>
      </div>

      {/* Toolbar: view tabs + New Booking CTA */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setView('seats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
              view === 'seats' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Seat Layout
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
              view === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Booking History
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                view === 'history' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {totalBookings}
              </span>
            </button>
        </div>

        {/* Stage diagram show/hide toggle */}
        {view === 'seats' && (
          <button
            onClick={() => setShowStage(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-black rounded-xl transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            {showStage ? 'Hide Stage' : 'View Stage'}
          </button>
        )}
      </div>

      {/* Stage Diagram (clickable) + seat rows of clicked block */}
      {view === 'seats' && (
      <div className="flex flex-col flex-1 min-h-0">
        {showStage && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg flex justify-center">
          <StageDiagram
            gradientIdPrefix="counterStage"
            flush
            className="w-full max-w-[460px]"
            activeBlock={activeBlock}
            onBlockClick={handleDiagramBlockSelect}
            labels={blockLabels}
            channelLabels={channelLabels}
            seatStats={seatStats}
            disabledBlocks={disabledBlocks}
          />
        </div>
        )}

        {/* All block categories — horizontal strip */}
        <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 w-full">
          {blockChips.map(([blockId, stats]) => {
            const isActive = activeBlock === blockId;
            const isDisabled = disabledBlocks.includes(blockId);
            return (
              <button
                key={blockId}
                onClick={() => !isDisabled && handleBlockSelect(blockId)}
                disabled={isDisabled}
                title={blockLabels[blockId] || `Block ${blockId}`}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-black whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : isDisabled
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{blockLabels[blockId] && blockLabels[blockId] !== blockId ? blockLabels[blockId] : `Block ${blockId}`}</span>
                <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {stats.booked}/{stats.total}
                </span>
              </button>
            );
          })}
          {blockChips.length === 0 && (
            <span className="text-[11px] font-semibold text-slate-400">No blocks configured yet</span>
          )}
        </div>

        {activeBlock && (
          <div className="w-full bg-gray-900 border-t border-gray-800 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-black text-sky-400 flex items-center gap-2">
                <Armchair className="w-3.5 h-3.5" />
                <span>Block {activeBlock} — tap seats to select</span>
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-gray-700 border border-gray-600"></span>
                  <span className="text-slate-300">Available</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500"></span>
                  <span className="text-emerald-400">Selected</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-900 border border-rose-700"></span>
                  <span className="text-rose-400">Booked</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/80"></span>
                  <span className="text-yellow-400">Reserved</span>
                </span>
                <button
                  onClick={() => {
                    setActiveBlock(null);
                    setSelectedSeats([]);
                  }}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-3 overflow-x-auto flex-1">
              {(() => {
                const typeGroups = getBlockSeatsByTicketType(activeBlock);
                if (typeGroups.size === 0) {
                  return (
                    <p className="text-xs text-gray-400 font-semibold text-center py-4">
                      No seats created for this block yet
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {Array.from(typeGroups.entries()).map(([key, group]) => {
                      const rows = Array.from(group.seatsByRow.keys()).sort();
                      const typeName = group.type?.name || 'Standard';
                      const groupColor = group.type?.color || '#38bdf8';
                      return (
                        <div key={key} className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
                          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/60 border-b border-gray-800">
                            <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: groupColor }} fill={groupColor} />
                            <span className="text-[11px] font-black text-gray-200">{typeName} Group</span>
                            <span className="text-[10px] font-semibold text-gray-500">— {activeBlock}: {rows.join(', ')}</span>
                            <span
                              className="ml-auto flex items-center gap-0.5 text-[11px] font-black flex-shrink-0"
                              style={{ color: groupColor }}
                            >
                              <IndianRupee className="w-3 h-3" />
                              {group.type?.price ?? 100}
                            </span>
                          </div>
                          <div className="p-2.5 space-y-2">
                            {rows.map((rowId) => (
                              <div key={rowId} className="flex items-center gap-2">
                                <span className="w-14 text-right text-[10px] font-bold text-gray-400 flex-shrink-0">
                                  Row {rowId}
                                </span>
                                <div className="flex gap-1.5 flex-wrap">
                                  {group.seatsByRow.get(rowId)?.map((seat) => {
                                    const isBooked = seat.status === 'booked';
                                    const isReserved = isSeatReserved(seat);
                                    const isBlocked = isBooked || isReserved;
                                    const isSelected = selectedSeats.includes(seat.id);
                                    return (
                                      <button
                                        key={seat.id}
                                        onClick={() => handleSeatToggle(seat.id, isBlocked)}
                                        disabled={isBlocked}
                                        className={`h-7 w-7 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                                          isBooked
                                            ? 'bg-rose-950/60 border border-rose-800/80 text-rose-400 cursor-not-allowed'
                                            : isReserved
                                            ? 'bg-yellow-500/20 border border-yellow-500/80 text-yellow-300 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-emerald-500 text-gray-950 scale-110 shadow-md shadow-emerald-500/30'
                                            : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                                        }`}
                                        title={`${typeName} — Row ${rowId}, Seat ${seat.seatLabel || seat.seatNumber} — ${isBooked ? 'Booked (online or counter)' : isReserved ? 'Reserved — customer checkout in progress' : isSelected ? 'Selected' : 'Available'} • ₹${seatPrice(seat)}`}
                                      >
                                        {seat.seatLabel || seat.seatNumber}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Floating selection bar — popup navbar shown only when seats are selected */}
        {selectedSeats.length > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/15 px-4 py-3 flex flex-wrap justify-between items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] font-semibold">Selected: </span>
              <span className="font-black text-emerald-600 text-xs">
                {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}
              </span>
              <span className="text-[11px] font-bold text-indigo-600 ml-2">₹{selectedTotal}</span>
              <p className="text-[10px] text-slate-500 truncate max-w-[380px]">
                {getSelectedSeatObjects().map(s => `Row ${s.rowId}-${s.seatLabel || s.seatNumber}`).join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedSeats([])}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleBookSelected}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-black rounded-lg transition-colors shadow-lg shadow-emerald-500/25"
              >
                Book {selectedSeats.length} Seats • ₹{selectedTotal}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Booking History View */}
      {view === 'history' && (
      <div className="space-y-4">
        {/* Search / filter / export bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ticket #, phone or type…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked-in</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={handleExportCSV}
            disabled={filteredBookings.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-600">No bookings found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or create a new booking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Ticket #</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Ticket Type</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Seats</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Payment</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-indigo-600">{booking.ticketNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-800">{booking.customerName || 'Guest'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600">{booking.customerPhone || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-700">{getTicketTypeName(booking.ticketTypeId, booking.ticketTypeName)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-800" title={(booking.seats || []).join(', ')}>
                          {booking.quantity || 0}
                          {booking.seats && booking.seats.length > 0 && (
                            <span className="font-semibold text-slate-500"> ({booking.seats.join(', ')})</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-800">₹{booking.amount?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                          {booking.paymentMethod || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600">
                          {booking.date}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onPrintTicket(booking)}
                            className="w-8 h-8 rounded-lg hover:bg-indigo-50 text-indigo-600 flex items-center justify-center transition-colors"
                            title="Print Ticket"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === booking.id ? null : booking.id)}
                              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {openMenuId === booking.id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onPrintTicket(booking);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                >
                                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Print Slip</span>
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(booking)}
                                  disabled={booking.status === 'Cancelled' || booking.status === 'Refunded'}
                                  className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Cancel & Release</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
