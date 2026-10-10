'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '@/lib/firebase';
import { BookingItem } from '@/types';
import { formatINR } from '@/lib/utils';
import {
  Search,
  Download,
  Printer,
  QrCode,
  Plus,
  Eye,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface AdminBookingsProps {
  currentShowId?: string;
  initialBookings?: BookingItem[];
  onOpenNewBooking?: () => void;
  onSelectBooking?: (booking: BookingItem) => void;
  onPrintTicket?: (booking: BookingItem) => void;
  /** Pre-filtered view used by the Booking Management sidebar group. */
  preset?: 'all' | 'active' | 'cancelled' | 'cancellation-history' | 'refunds';
}

const PRESET_META: Record<
  NonNullable<AdminBookingsProps['preset']>,
  { title: string; subtitle: string }
> = {
  all: {
    title: 'Bookings & Transactions',
    subtitle: 'Real-time reactive stream (`onSnapshot`) • Instant synchronization between customer bookings and admin dashboard.',
  },
  active: {
    title: 'Active Tickets',
    subtitle: 'Confirmed & checked-in bookings — tickets that are still valid for entry.',
  },
  cancelled: {
    title: 'Cancelled Tickets',
    subtitle: 'Cancelled bookings — their seats are released back to inventory for resale.',
  },
  'cancellation-history': {
    title: 'Cancellation History',
    subtitle: 'Full history of cancelled and refunded bookings with amounts and channels.',
  },
  refunds: {
    title: 'Refund Management',
    subtitle: 'Refunded bookings — payment returned to the customer.',
  },
};

export default function AdminBookings({
  currentShowId,
  initialBookings = [],
  onOpenNewBooking,
  onSelectBooking,
  onPrintTicket,
  preset = 'all',
}: AdminBookingsProps) {
  const presetMeta = PRESET_META[preset] || PRESET_META.all;
  const [bookings, setBookings] = useState<BookingItem[]>(initialBookings);
  const [loading, setLoading] = useState(!initialBookings.length);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Counter'>('All');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Confirmed' | 'Checked-in' | 'Cancelled' | 'Refunded'
  >('All');
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const previousIdsRef = useRef<Set<string>>(new Set());

  // ─── Reactive Firestore onSnapshot Listener with Lifecycle Cleanup ───
  useEffect(() => {
    isInitialLoadRef.current = true;
    previousIdsRef.current = new Set();
    setLoading(true);
    setConnectionError(null);

    let unsubscribe: Unsubscribe | null = null;
    let fallbackUnsubscribe: Unsubscribe | null = null;

    try {
      const bookingsCol = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);

      // Primary real-time query: filtered by showId and sorted by createdAt descending
      let q = currentShowId
        ? query(
            bookingsCol,
            where('showId', '==', currentShowId),
            orderBy('createdAt', 'desc')
          )
        : query(bookingsCol, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setIsLiveConnected(true);
          setConnectionError(null);
          setLoading(false);

          const fetchedBookings: BookingItem[] = [];
          const currentIds = new Set<string>();

          snapshot.forEach((doc) => {
            const data = doc.data();
            const item: BookingItem = {
              id: doc.id,
              bookingId: data.bookingId || data.ticketNumber || doc.id,
              showId: data.showId || data.eventId || '',
              eventId: data.eventId || data.showId || '',
              eventName: data.eventName || '',
              ticketNumber: data.ticketNumber || doc.id,
              customerName: data.customerName || 'Walk-in',
              customerPhone: data.customerPhone || '',
              customerEmail: data.customerEmail || '',
              ticketTypeId: data.ticketTypeId || '',
              ticketTypeName: data.ticketTypeName || 'General',
              quantity: Number(data.quantity) || 1,
              unitPrice: Number(data.unitPrice) || 0,
              ticketAmount: Number(data.ticketAmount) || Number(data.amount) || 0,
              baseAmount: Number(data.baseAmount) || Number(data.ticketAmount) || 0,
              convenienceFee: Number(data.convenienceFee) || 0,
              gstOnConvenienceFee: Number(data.gstOnConvenienceFee) || 0,
              platformCharge: Number(data.platformCharge) || 0,
              totalFees: Number(data.totalFees) || 0,
              amount: Number(data.amount) || 0,
              finalCustomerAmount: Number(data.finalCustomerAmount) || Number(data.amount) || 0,
              date: data.date || '',
              time: data.time || '',
              source: (data.source as any) || 'Counter',
              paymentMethod: (data.paymentMethod as any) || 'Cash',
              transactionId: data.transactionId || '',
              status: (data.status as any) || 'Confirmed',
              bookingStatus: data.bookingStatus || data.status || 'Confirmed',
              assignedGate: data.assignedGate || '',
              block: data.block || '',
              seats: Array.isArray(data.seats) ? data.seats : [],
              seatCount: Number(data.seatCount) || (Array.isArray(data.seats) ? data.seats.length : 1),
              seatNumber: data.seatNumber || null,
              enteredCount: Number(data.enteredCount) || 0,
              remainingCount: Number(data.remainingCount) || 0,
              usedTickets: Array.isArray(data.usedTickets) ? data.usedTickets : [],
              usedSeats: Array.isArray(data.usedSeats) ? data.usedSeats : [],
              createdAt: data.createdAt ? (typeof data.createdAt === 'object' && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt)) : '',
            };
            fetchedBookings.push(item);
            currentIds.add(doc.id);
          });

          // Detect new incoming bookings in real-time
          if (!isInitialLoadRef.current && previousIdsRef.current.size > 0) {
            const freshIds = new Set<string>();
            currentIds.forEach((id) => {
              if (!previousIdsRef.current.has(id)) {
                freshIds.add(id);
              }
            });
            if (freshIds.size > 0) {
              setNewlyAddedIds(freshIds);
              // Clear flash after 4 seconds
              setTimeout(() => {
                setNewlyAddedIds((prev) => {
                  const next = new Set(prev);
                  freshIds.forEach((id) => next.delete(id));
                  return next;
                });
              }, 4000);
            }
          }

          isInitialLoadRef.current = false;
          previousIdsRef.current = currentIds;

          // Double check chronological sort
          fetchedBookings.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

          setBookings(fetchedBookings);
        },
        (error) => {
          console.warn('AdminBookings: Primary index listener failed, trying fallback...', error.message);

          // Graceful fallback: If index is still building or if documents use eventId
          if (currentShowId) {
            const fallbackQuery = query(
              bookingsCol,
              where('eventId', '==', currentShowId)
            );
            fallbackUnsubscribe = onSnapshot(
              fallbackQuery,
              (snap) => {
                setIsLiveConnected(true);
                setConnectionError(null);
                setLoading(false);
                const items: BookingItem[] = snap.docs.map((d) => ({
                  id: d.id,
                  ...d.data(),
                } as BookingItem));
                items.sort((a, b) => {
                  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return timeB - timeA;
                });
                setBookings(items);
              },
              (fallbackErr) => {
                console.error('AdminBookings listener error:', fallbackErr);
                setConnectionError(fallbackErr.message || 'Live connection disconnected');
                setIsLiveConnected(false);
                setLoading(false);
              }
            );
          } else {
            setConnectionError(error.message || 'Error subscribing to bookings');
            setIsLiveConnected(false);
            setLoading(false);
          }
        }
      );
    } catch (err: any) {
      console.error('Failed to initialize Firestore listener:', err);
      setConnectionError(err.message || 'Firestore initialization failed');
      setIsLiveConnected(false);
      setLoading(false);
    }

    // Unsubscribe cleanup handler to prevent orphan reads & memory leaks
    return () => {
      if (unsubscribe) unsubscribe();
      if (fallbackUnsubscribe) fallbackUnsubscribe();
    };
  }, [currentShowId]);

  // Filtering (preset scopes the table to the Booking Management section)
  const matchesPreset = (b: BookingItem) => {
    switch (preset) {
      case 'active':
        return b.status === 'Confirmed' || b.status === 'Checked-in';
      case 'cancelled':
        return b.status === 'Cancelled';
      case 'cancellation-history':
        return b.status === 'Cancelled' || b.status === 'Refunded';
      case 'refunds':
        return b.status === 'Refunded';
      default:
        return true;
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (!matchesPreset(b)) return false;
    const matchesSearch =
      (b.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.ticketNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.customerPhone || '').includes(searchTerm) ||
      (b.ticketTypeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.block || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = sourceFilter === 'All' || b.source === sourceFilter;
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;

    return matchesSearch && matchesSource && matchesStatus;
  });

  const onlineCount = bookings.filter((b) => b.source === 'Online').length;
  const counterCount = bookings.filter((b) => b.source === 'Counter').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = [
      'Booking ID,Customer,Phone,Category,Qty,Amount,Source,Payment,Status,Gate,Block,Seats,Created At',
    ];
    const rows = filteredBookings.map((b) =>
      `"${b.ticketNumber}","${b.customerName}","${b.customerPhone}","${b.ticketTypeName}",${b.quantity},${b.amount},"${b.source}","${b.paymentMethod}","${b.status}","${b.assignedGate}","${b.block || ''}","${(b.seats || []).join(';') || ''}","${b.createdAt || ''}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `jatra_bookings_${currentShowId || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-900">{presetMeta.title}</h2>
            {isLiveConnected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Sync Active</span>
              </span>
            ) : connectionError ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                <WifiOff className="w-3 h-3 text-rose-600" />
                <span>Sync Offline</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                <span>Connecting…</span>
              </span>
            )}
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {filteredBookings.length} Listed
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {presetMeta.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {onOpenNewBooking && (
            <button
              onClick={onOpenNewBooking}
              className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Booking</span>
            </button>
          )}
        </div>
      </div>

      {/* Fallback / Offline / Connection Notification */}
      {connectionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>
              <strong>Connection Notice:</strong> {connectionError}. Showing latest cached records.
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="underline font-bold hover:text-rose-950"
          >
            Reload
          </button>
        </div>
      )}

      {/* Stats Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Total Orders</span>
          <span className="text-lg font-black text-slate-900">{bookings.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <span className="text-[10px] font-black uppercase text-emerald-600 block">Online Bookings</span>
          <span className="text-lg font-black text-emerald-600">{onlineCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <span className="text-[10px] font-black uppercase text-amber-600 block">Counter Sales</span>
          <span className="text-lg font-black text-amber-600">{counterCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <span className="text-[10px] font-black uppercase text-indigo-600 block">Revenue</span>
          <span className="text-lg font-black text-indigo-600">₹{totalRevenue.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, phone, ticket ID (e.g. NJ26-00001), block..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Source dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <span className="text-slate-400 text-[10px] uppercase">Channel:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              <option value="All">All Channels</option>
              <option value="Online">Online</option>
              <option value="Counter">Counter</option>
            </select>
          </div>

          {/* Status dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <span className="text-slate-400 text-[10px] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              <option value="All">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Checked-in">Checked-in</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Block / Seats</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-center">Channel</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Gate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                      <span>Streaming bookings in real-time…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                    No bookings found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const isJustAdded = newlyAddedIds.has(b.id);
                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${
                        isJustAdded
                          ? 'bg-emerald-50/80 ring-2 ring-emerald-400 ring-inset'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-4 font-black text-indigo-600">
                        <div className="flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span>{b.ticketNumber}</span>
                          {isJustAdded && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded-full animate-bounce">
                              <Sparkles className="w-2.5 h-2.5" />
                              NEW
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 truncate max-w-[140px]">
                        {b.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {b.customerPhone || '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {b.ticketTypeName}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {b.block ? (
                          <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-1.5 py-0.5 rounded mr-1">
                            {b.block}
                          </span>
                        ) : null}
                        {b.seats && b.seats.length > 0 ? (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {b.seats.slice(0, 3).join(', ')}
                            {b.seats.length > 3 ? ` +${b.seats.length - 3}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-black">
                        {b.quantity}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        <div>₹{b.amount}</div>
                        {b.ticketAmount !== undefined && b.convenienceFee !== undefined && b.convenienceFee > 0 && (
                          <div className="text-[10px] text-slate-400 font-semibold">
                            base: ₹{b.ticketAmount}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            b.source === 'Online'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-orange-50 text-orange-600 border-orange-200'
                          }`}
                        >
                          {b.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                          {b.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {b.status === 'Cancelled' || b.status === 'Refunded' ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            Cancelled
                          </span>
                        ) : b.quantity > 1 ? (
                          (() => {
                            const usedCount =
                              b.enteredCount ??
                              (Array.isArray(b.usedTickets) ? b.usedTickets.length : 0);
                            if (usedCount >= b.quantity || b.status === 'Checked-in') {
                              return (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  All Used ({b.quantity}/{b.quantity})
                                </span>
                              );
                            }
                            if (usedCount > 0) {
                              return (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {usedCount} / {b.quantity} Entered
                                </span>
                              );
                            }
                            return (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Active (0/{b.quantity})
                              </span>
                            );
                          })()
                        ) : (
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              b.status === 'Checked-in'
                                ? 'bg-blue-100 text-blue-700'
                                : b.status === 'Confirmed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {b.status === 'Checked-in' ? 'Entered' : b.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">
                        {b.assignedGate || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onSelectBooking && (
                            <button
                              onClick={() => onSelectBooking(b)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onPrintTicket && (
                            <button
                              onClick={() => onPrintTicket(b)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                              title="Print Thermal Ticket / Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
