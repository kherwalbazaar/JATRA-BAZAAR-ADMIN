'use client';

import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Users,
  IndianRupee,
  Ticket,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  MapPin,
  Armchair
} from 'lucide-react';
import { BookingItem, EventItem, TicketType, Seat } from '@/types';

interface CounterBookingViewProps {
  currentEvent: EventItem | null;
  bookings: BookingItem[];
  ticketTypes: TicketType[];
  seats: Seat[];
  onOpenNewBooking: () => void;
  onPrintTicket: (booking: BookingItem) => void;
}

export default function CounterBookingView({
  currentEvent,
  bookings,
  ticketTypes,
  seats,
  onOpenNewBooking,
  onPrintTicket
}: CounterBookingViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'checked-in' | 'cancelled'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [showSeatMap, setShowSeatMap] = useState(false);

  // Filter bookings for counter sales
  const counterBookings = bookings.filter(booking => booking.source === 'Counter');

  // Apply filters
  const filteredBookings = counterBookings.filter(booking => {
    const matchesSearch =
      booking.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'confirmed' && booking.status === 'Confirmed') ||
      (statusFilter === 'checked-in' && booking.status === 'Checked-in') ||
      (statusFilter === 'cancelled' && (booking.status === 'Refunded' || booking.status === 'Cancelled'));

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalBookings = counterBookings.length;
  const totalRevenue = counterBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const confirmedBookings = counterBookings.filter(b => b.status === 'Confirmed').length;
  const checkedInBookings = counterBookings.filter(b => b.status === 'Checked-in').length;
  const cancelledBookings = counterBookings.filter(b => b.status === 'Refunded' || b.status === 'Cancelled').length;

  // Venue Map Blocks - only show blocks that have seats in the database
  const venueBlocks = useMemo(() => {
    const blocksWithSeats = new Set(seats.map(seat => seat.blockId));
    return blocksWithSeats;
  }, [seats]);

  // Get seats for a specific block
  const getBlockSeats = (blockId: string) => {
    const blockSeats = seats.filter(seat => seat.blockId === blockId);
    // Group by row
    const seatsByRow = new Map<string, Seat[]>();
    blockSeats.forEach(seat => {
      if (!seatsByRow.has(seat.rowId)) {
        seatsByRow.set(seat.rowId, []);
      }
      seatsByRow.get(seat.rowId)!.push(seat);
    });
    // Sort seats within each row by seat number
    seatsByRow.forEach(seatList => {
      seatList.sort((a, b) => a.seatNumber - b.seatNumber);
    });
    return seatsByRow;
  };

  // Handle block selection
  const handleBlockSelect = (blockId: string) => {
    setActiveBlock(blockId);
    setSelectedSeats([]);
  };

  // Handle seat selection
  const handleSeatToggle = (seatId: string, isBooked: boolean) => {
    if (isBooked) return;
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <span>Counter Booking</span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Manage counter ticket sales, process payments, and issue physical tickets
          </p>
        </div>
        <button
          onClick={onOpenNewBooking}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Booking</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalBookings}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmed</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{confirmedBookings}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked-in</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{checkedInBookings}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cancelled</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{cancelledBookings}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSeatMap(!showSeatMap)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              showSeatMap
                ? 'bg-[#4f39f6] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{showSeatMap ? 'View Bookings List' : 'Seat Map'}</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked-in</option>
            <option value="cancelled">Refunded/Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Seat Map View Mode */}
      {showSeatMap && (
        <div className="space-y-6">
          {/* Stage Diagram Container */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-black text-sky-400 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>Stage Layout & Block Selector</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Click any block below to load its interactive seat matrix
              </p>
            </div>
            <div className="p-4">
              <svg viewBox="0 0 1000 900" className="w-full h-auto select-none" xmlns="http://www.w3.org/2000/svg">
                {/* Background */}
                <rect width="1000" height="900" fill="#0f172a" rx="20" />

                {/* STAGE (Center Top) */}
                <g>
                  <rect
                    x="370"
                    y="40"
                    width="260"
                    height="190"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    rx="10"
                  />
                  <text
                    x="500"
                    y="135"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="28"
                    fontWeight="bold"
                    letterSpacing="2"
                  >
                    STAGE
                  </text>
                  <text
                    x="500"
                    y="170"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="14"
                    letterSpacing="4"
                  >
                    FRONT
                  </text>
                </g>

                {/* BLOCK C2 (Top Left) */}
                <g onClick={() => handleBlockSelect('C2')} className="cursor-pointer group">
                  <rect
                    x="40"
                    y="40"
                    width="310"
                    height="190"
                    fill={activeBlock === 'C2' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'C2' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'C2' ? 3.5 : 2}
                    rx="6"
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="195" y="145" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    C2
                  </text>
                </g>

                {/* BLOCK A2 (Top Right) */}
                <g onClick={() => handleBlockSelect('A2')} className="cursor-pointer group">
                  <rect
                    x="650"
                    y="40"
                    width="310"
                    height="190"
                    fill={activeBlock === 'A2' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'A2' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'A2' ? 3.5 : 2}
                    rx="6"
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="805" y="145" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    A2
                  </text>
                </g>

                {/* BLOCK C3 (Outer Left) */}
                <g onClick={() => handleBlockSelect('C3')} className="cursor-pointer group">
                  <polygon
                    points="40,250 170,250 170,680 40,840"
                    fill={activeBlock === 'C3' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'C3' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'C3' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="105" y="530" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    C3
                  </text>
                </g>

                {/* BLOCK C / C1 (Inner Left) */}
                <g onClick={() => handleBlockSelect('C')} className="cursor-pointer group">
                  <polygon
                    points="190,250 350,250 350,420 190,660"
                    fill={activeBlock === 'C' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'C' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'C' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="270" y="450" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    C
                  </text>
                </g>

                {/* BLOCK A (Inner Right) */}
                <g onClick={() => handleBlockSelect('A')} className="cursor-pointer group">
                  <polygon
                    points="650,250 810,250 810,660 650,420"
                    fill={activeBlock === 'A' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'A' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'A' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="730" y="450" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    A
                  </text>
                </g>

                {/* BLOCK A3 (Outer Right) */}
                <g onClick={() => handleBlockSelect('A3')} className="cursor-pointer group">
                  <polygon
                    points="830,250 960,250 960,840 830,680"
                    fill={activeBlock === 'A3' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'A3' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'A3' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="895" y="530" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    A3
                  </text>
                </g>

                {/* BLOCK B (Main Center Front Trapezoid) */}
                <g onClick={() => handleBlockSelect('B')} className="cursor-pointer group">
                  <polygon
                    points="370,420 630,420 780,660 220,660"
                    fill={activeBlock === 'B' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'B' ? '#38bdf8' : '#38bdf8'}
                    strokeWidth={activeBlock === 'B' ? 3.5 : 2.5}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="500" y="550" textAnchor="middle" fill="#38bdf8" fontSize="44" fontWeight="extrabold" pointerEvents="none">
                    B
                  </text>
                </g>

                {/* BLOCK B2 (Bottom Left) */}
                <g onClick={() => handleBlockSelect('B2')} className="cursor-pointer group">
                  <polygon
                    points="200,680 480,680 480,860 60,860"
                    fill={activeBlock === 'B2' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'B2' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'B2' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="290" y="780" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    B2
                  </text>
                </g>

                {/* BLOCK B3 (Bottom Right) */}
                <g onClick={() => handleBlockSelect('B3')} className="cursor-pointer group">
                  <polygon
                    points="520,680 800,680 940,860 520,860"
                    fill={activeBlock === 'B3' ? '#0369a1' : '#1e293b'}
                    stroke={activeBlock === 'B3' ? '#38bdf8' : '#475569'}
                    strokeWidth={activeBlock === 'B3' ? 3.5 : 2}
                    className="transition-all hover:fill-[#0284c7]"
                  />
                  <text x="710" y="780" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="bold" pointerEvents="none">
                    B3
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Seat Selection Panel for Active Block */}
          {activeBlock && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="text-sm font-black text-sky-400 flex items-center gap-2">
                      <Armchair className="w-4 h-4 text-sky-400" />
                      <span>Block {activeBlock} - Seat Layout</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Select available seats to proceed with the counter booking
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-600"></span>
                      <span className="text-slate-300">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-rose-900 border border-rose-700"></span>
                      <span className="text-rose-400">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-600"></span>
                      <span className="text-emerald-400">Selected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seat Matrix Container */}
              <div className="p-4">
                <div className="overflow-x-auto">
                  {(() => {
                    const seatsByRow = getBlockSeats(activeBlock);
                    const rows = Array.from(seatsByRow.keys()).sort();
                    if (rows.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-400 font-semibold">No seats created for this block yet</p>
                          <p className="text-xs text-slate-500 mt-1">Use the seat configuration settings to add seats to this block</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {rows.map((rowId) => (
                          <div key={rowId} className="flex items-center gap-3">
                            <div className="w-16 text-right">
                              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">Row {rowId}</span>
                            </div>
                            <div className="flex gap-2 flex-wrap flex-1">
                              {seatsByRow.get(rowId)?.map((seat) => {
                                const isSelected = selectedSeats.includes(seat.id);
                                const isBooked = seat.status === 'booked';
                                return (
                                  <button
                                    key={seat.id}
                                    onClick={() => handleSeatToggle(seat.id, isBooked)}
                                    disabled={isBooked}
                                    className={`h-10 w-10 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                                      isBooked
                                        ? 'bg-rose-950/60 border border-rose-800/80 text-rose-500 cursor-not-allowed'
                                        : isSelected
                                        ? 'bg-emerald-500 text-slate-950 font-bold scale-105 shadow-md shadow-emerald-500/20'
                                        : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                                    }`}
                                    title={`Row ${rowId}, Seat ${seat.seatLabel || seat.seatNumber} - ${isBooked ? 'Booked' : 'Available'}`}
                                  >
                                    {seat.seatLabel || seat.seatNumber}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Selection Summary Footer */}
              <div className="p-4 border-t border-slate-800 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <span className="text-slate-400 text-sm">Selected seats: </span>
                  <span className="font-bold text-sky-400">
                    {selectedSeats.length > 0 ? selectedSeats.length : 'None'}
                  </span>
                  {selectedSeats.length > 0 && (
                    <span className="text-xs text-slate-500 ml-2">
                      ({getSelectedSeatObjects().map(s => `Row ${s.rowId}, Seat ${s.seatLabel || s.seatNumber}`).join(', ')})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveBlock(null);
                      setSelectedSeats([]);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={onOpenNewBooking}
                    disabled={selectedSeats.length === 0}
                    className="px-6 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-lg shadow-sky-500/20"
                  >
                    Book {selectedSeats.length} Seats
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bookings Table View Mode */}
      {!showSeatMap && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-600">No counter bookings found</p>
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
                        <span className="text-xs font-bold text-slate-800">{booking.quantity || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-800">₹{booking.amount?.toLocaleString() || 0}</span>
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
                              <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                                <button className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                                  <Edit className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Edit</span>
                                </button>
                                <button className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
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
      )}
    </div>
  );
}