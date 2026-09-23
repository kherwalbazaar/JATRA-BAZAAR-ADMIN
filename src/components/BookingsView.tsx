'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  CheckCircle2, 
  QrCode, 
  Phone, 
  Calendar, 
  DoorOpen, 
  CreditCard,
  Plus,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { BookingItem } from '@/types';
import { formatINR } from '@/lib/utils';

interface BookingsViewProps {
  bookings: BookingItem[];
  onOpenNewBooking: () => void;
  onSelectBooking: (booking: BookingItem) => void;
  onPrintTicket: (booking: BookingItem) => void;
}

export default function BookingsView({
  bookings,
  onOpenNewBooking,
  onSelectBooking,
  onPrintTicket
}: BookingsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Counter'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Confirmed' | 'Checked-in'>('All');

  // Filter records
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch = 
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerPhone.includes(searchTerm) ||
      b.ticketTypeName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = sourceFilter === 'All' || b.source === sourceFilter;
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;

    return matchesSearch && matchesSource && matchesStatus;
  });

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = ['Booking ID,Customer,Phone,Ticket Type,Qty,Amount,Source,Payment,Status,Gate,Time'];
    const rows = filteredBookings.map(b => 
      `"${b.ticketNumber}","${b.customerName}","${b.customerPhone}","${b.ticketTypeName}",${b.quantity},${b.amount},"${b.source}","${b.paymentMethod}","${b.status}","${b.assignedGate}","${b.time}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jatra_bazaar_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Bookings & Transactions</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {filteredBookings.length} Listed
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Search, verify, reprint receipts, and track all ticket orders across online and counter channels.
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

          <button
            onClick={onOpenNewBooking}
            className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Booking</span>
          </button>
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
            placeholder="Search by customer name, phone, ticket ID (e.g. JB26-00325)..."
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
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    No bookings found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-black text-indigo-600 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{b.ticketNumber}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 truncate max-w-[140px]">
                      {b.customerName}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {b.customerPhone}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {b.ticketTypeName}
                    </td>
                    <td className="py-3 px-4 text-center font-black">
                      {b.quantity}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      ₹{b.amount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        b.source === 'Online' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-orange-50 text-orange-600 border-orange-200'
                      }`}>
                        {b.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {b.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        b.status === 'Checked-in'
                          ? 'bg-blue-100 text-blue-700'
                          : b.status === 'Confirmed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-600">
                      {b.assignedGate}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectBooking(b)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPrintTicket(b)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                          title="Print Thermal Ticket / Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
