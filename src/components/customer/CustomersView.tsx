'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  Ban,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { CustomerRecord } from '@/types/customer';
import {
  fetchAdminCustomers,
  fetchCustomerBookingHistory,
  updateCustomerAccountStatus,
} from '@/lib/customer-admin';

export default function CustomersView() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected customer for modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open Details Modal and fetch booking history
  const openCustomerDetails = async (customer: CustomerRecord) => {
    setSelectedCustomer(customer);
    setLoadingBookings(true);
    try {
      const bookings = await fetchCustomerBookingHistory(customer.mobile);
      setCustomerBookings(bookings);
    } catch (e) {
      console.error('Failed to load customer bookings:', e);
      setCustomerBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return { date: '—', time: '' };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { date: '—', time: '' };
      const date = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const time = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return { date, time };
    } catch {
      return { date: '—', time: '' };
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedCustomer) return;
    const nextStatus: 'active' | 'blocked' = selectedCustomer.status === 'blocked' ? 'active' : 'blocked';
    setStatusUpdating(true);

    const success = await updateCustomerAccountStatus(
      selectedCustomer.id,
      selectedCustomer.mobile,
      nextStatus
    );

    if (success) {
      const updated: CustomerRecord = {
        ...selectedCustomer,
        status: nextStatus,
        is_active: nextStatus === 'active',
      };
      setSelectedCustomer(updated);
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? updated : c))
      );
    }
    setStatusUpdating(false);
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const created = new Date(c.created_at || 0).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (dateFilter === 'today' && now - created > oneDay) return false;
        if (dateFilter === 'week' && now - created > 7 * oneDay) return false;
        if (dateFilter === 'month' && now - created > 30 * oneDay) return false;
      }

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (c.full_name || '').toLowerCase();
      const phone = (c.mobile || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      const email = (c.email || '').toLowerCase();

      return name.includes(q) || phone.includes(q) || id.includes(q) || email.includes(q);
    });
  }, [customers, statusFilter, dateFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Overall metrics
  const activeCount = useMemo(
    () => customers.filter((c) => c.status === 'active').length,
    [customers]
  );
  const totalBookingsCount = useMemo(
    () => customers.reduce((acc, c) => acc + (c.total_bookings || 0), 0),
    [customers]
  );
  const totalRevenue = useMemo(
    () => customers.reduce((acc, c) => acc + (c.total_spent || 0), 0),
    [customers]
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            Customer Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real customer records, mobile verifications, and audience profiles from Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Customers
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {customers.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Verified audience accounts</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Status
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {activeCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Unrestricted active users</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Customer Bookings
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-600 mt-2">
            {totalBookingsCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total tickets purchased</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Customer Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="font-bold text-sm">₹</span>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Cumulative bookings value</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by customer name or mobile number (+91)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="blocked">Blocked Only</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="today">Registered Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>

            {/* Per Page */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                <th className="py-3.5 px-4 sm:px-6">Customer Name</th>
                <th className="py-3.5 px-4 sm:px-6">Verified Mobile</th>
                <th className="py-3.5 px-4 sm:px-6">Registration</th>
                <th className="py-3.5 px-4 sm:px-6">Last Visit</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
                <th className="py-3.5 px-4 sm:px-6">Total Bookings</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <p className="font-bold">Loading real customer data from Supabase...</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">No customers found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try adjusting your search criteria.'
                        : 'New customer profiles will show here upon OTP verification.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => {
                  const isBlocked = c.status === 'blocked';
                  return (
                    <tr
                      key={c.id || c.mobile}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Customer Name */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                            {c.full_name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-snug">
                              {c.full_name}
                            </div>
                            {c.email && (
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-xs sm:max-w-sm md:max-w-md">
                                {c.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Verified Mobile Number */}
                      <td className="py-3.5 px-4 sm:px-6 font-mono whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="text-slate-400 text-[10px]">+91</span>
                          <span>{c.mobile}</span>
                          <span title="Verified Mobile Number via OTP">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          </span>
                        </div>
                      </td>

                      {/* Registration Date & Time */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        {(() => {
                          const dt = formatDateTime(c.created_at);
                          if (dt.date === '—') {
                            return <span className="text-slate-400 text-[11px]">—</span>;
                          }
                          return (
                            <div className="flex flex-col leading-tight">
                              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span>{dt.date}</span>
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span>{dt.time}</span>
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Last Visit Date & Time */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        {(() => {
                          const dt = formatDateTime(c.last_login_at);
                          if (dt.date === '—') {
                            return <span className="text-slate-400 text-[11px]">—</span>;
                          }
                          return (
                            <div className="flex flex-col leading-tight">
                              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span>{dt.date}</span>
                              </span>
                              <span className="text-[10px] font-mono text-indigo-600 font-bold flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                                <span>{dt.time}</span>
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                            isBlocked
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isBlocked ? (
                            <>
                              <XCircle className="w-3 h-3" />
                              Blocked
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </>
                          )}
                        </span>
                      </td>

                      {/* Total Bookings */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800">
                            {c.total_bookings || 0}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (₹{(c.total_spent || 0).toLocaleString('en-IN')})
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openCustomerDetails(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-bold text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View History</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredCustomers.length > 0 && (
          <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-800">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * pageSize, filteredCustomers.length)}
              </span>{' '}
              of{' '}
              <span className="font-bold text-slate-800">
                {filteredCustomers.length}
              </span>{' '}
              customers
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-slate-600 font-bold px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Details & Booking History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-white font-black text-lg flex items-center justify-center">
                  {selectedCustomer.full_name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div>
                  <h3 className="text-lg font-black leading-tight flex items-center gap-2">
                    {selectedCustomer.full_name}
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        selectedCustomer.status === 'blocked'
                          ? 'bg-rose-500/30 text-rose-300 border border-rose-400/30'
                          : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {selectedCustomer.status || 'Active'}
                    </span>
                  </h3>
                  <div className="text-xs text-indigo-200 font-mono flex items-center gap-2 mt-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>+91 {selectedCustomer.mobile}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Bookings
                  </span>
                  <span className="text-base font-black text-slate-900 mt-0.5 block">
                    {selectedCustomer.total_bookings || customerBookings.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Spent
                  </span>
                  <span className="text-base font-black text-emerald-600 mt-0.5 block">
                    ₹{(selectedCustomer.total_spent || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Registration
                  </span>
                  <span className="font-bold text-slate-700 mt-0.5 block">
                    {(() => {
                      const dt = formatDateTime(selectedCustomer.created_at);
                      if (dt.date === '—') return '—';
                      return (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span>{dt.date}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-mono font-bold">
                            {dt.time}
                          </span>
                        </span>
                      );
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Last Visit
                  </span>
                  <span className="font-bold text-slate-700 mt-0.5 block">
                    {(() => {
                      const dt = formatDateTime(selectedCustomer.last_login_at);
                      if (dt.date === '—') return '—';
                      return (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span>{dt.date}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-indigo-600 font-mono font-bold">
                            {dt.time}
                          </span>
                        </span>
                      );
                    })()}
                  </span>
                </div>
              </div>

              {/* Status Action */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">
                    Account Status: {selectedCustomer.status === 'blocked' ? 'Suspended / Blocked' : 'Active'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedCustomer.status === 'blocked'
                      ? 'This customer cannot book live tickets.'
                      : 'Customer can verify with OTP and purchase tickets.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={statusUpdating}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    selectedCustomer.status === 'blocked'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {selectedCustomer.status === 'blocked' ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Unblock Customer</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Block Customer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Booking History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-indigo-600" />
                    Booking History ({customerBookings.length})
                  </h4>
                </div>

                {loadingBookings ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Fetching customer booking history...
                  </div>
                ) : customerBookings.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    No tickets booked by this customer yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {customerBookings.map((b) => (
                      <div
                        key={b.id || b.ticket_number}
                        className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                              #{b.ticket_number || b.id}
                            </span>
                            <span className="font-black text-slate-900">
                              {b.event_name || b.event_id || 'Jatra Show'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                              {b.date || (b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '')}
                            </span>
                            <span>•</span>
                            <span>{b.quantity || (Array.isArray(b.seats) ? b.seats.length : 1)} Seat(s)</span>
                            {Array.isArray(b.seats) && b.seats.length > 0 && (
                              <span className="font-mono text-slate-700 font-bold">
                                [{b.seats.join(', ')}]
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="font-black text-slate-900 text-sm">
                            ₹{Number(b.final_customer_amount || b.amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                              b.status === 'Confirmed' || b.booking_status === 'Confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'Cancelled'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {b.status || b.booking_status || 'Confirmed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
