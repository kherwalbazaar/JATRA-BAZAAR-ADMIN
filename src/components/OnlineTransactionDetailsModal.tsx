'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  CreditCard,
  CalendarClock,
  Hash,
  Ticket,
  Printer,
  FileDown,
  ReceiptText,
  CheckCircle2,
  CircleAlert,
  Layers,
} from 'lucide-react';
import { TicketItem } from '@/types';
import { listenTicketsByBookingId } from '@/lib/firestore';
import { formatINR } from '@/lib/utils';
import {
  TransactionView,
  buildTransactionView,
  buildReceiptHtml,
  downloadHtml,
  printHtml,
} from '@/lib/onlineHistory';

interface OnlineTransactionDetailsModalProps {
  txn: TransactionView | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusCls: Record<string, string> = {
  Successful: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Pending: 'bg-amber-100 text-amber-800 border-amber-200',
  Failed: 'bg-red-100 text-red-700 border-red-200',
  Refunded: 'bg-blue-100 text-blue-700 border-blue-200',
  Cancelled: 'bg-slate-200 text-slate-700 border-slate-300',
};

const entryCls: Record<string, string> = {
  Used: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Unused: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
};

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 min-w-0">
      <span className="text-[9px] uppercase font-black text-slate-400 flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-extrabold text-slate-800 text-xs block truncate mt-0.5">
        {value || '—'}
      </span>
    </div>
  );
}

export default function OnlineTransactionDetailsModal({
  txn,
  isOpen,
  onClose,
}: OnlineTransactionDetailsModalProps) {
  const [liveTickets, setLiveTickets] = useState<TicketItem[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  const bookingId = txn?.bookingId || '';

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setLiveTickets([]);
      setTicketsLoaded(false);
      return;
    }
    let unsub: (() => void) | null = null;
    try {
      unsub = listenTicketsByBookingId(bookingId, (list) => {
        setLiveTickets(list);
        setTicketsLoaded(true);
      });
    } catch {
      setLiveTickets([]);
      setTicketsLoaded(true);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, bookingId]);

  const view = useMemo(() => {
    if (!txn) return null;
    if (liveTickets.length === 0) return txn;
    return buildTransactionView(txn.booking, liveTickets);
  }, [txn, liveTickets]);

  if (!isOpen || !txn || !view) return null;

  const f = view.finance;
  const usedCount = view.tickets.filter((t) => t.entryStatus === 'Used').length;

  const fileName = `jatra_${view.transactionId || view.bookingId || 'receipt'}`;

  const handlePrint = (kind: 'receipt' | 'invoice') =>
    printHtml(buildReceiptHtml(view, kind));
  const handleDownload = () =>
    downloadHtml(buildReceiptHtml(view, 'receipt'), `${fileName}.html`);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wide">Transaction Details</span>
                <span className="text-[10px] bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded font-mono font-black">
                  {view.transactionId || view.bookingId}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                    statusCls[view.paymentStatus] || statusCls.Cancelled
                  }`}
                >
                  {view.paymentStatus}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">
                {view.eventName || '—'} • Payment status and ticket entry status are tracked separately
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Customer Information */}
          <section className="space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              Customer Information
            </h5>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Field label="Customer Name" value={view.customerName} />
              <Field
                label="Mobile Number"
                value={view.mobile}
                icon={<Phone className="w-2.5 h-2.5 mr-1" />}
              />
              <Field
                label="Email"
                value={view.email}
                icon={<Mail className="w-2.5 h-2.5 mr-1" />}
              />
              <Field
                label="Booking ID"
                value={view.bookingId}
                icon={<Hash className="w-2.5 h-2.5 mr-1" />}
              />
            </div>
          </section>

          {/* Payment Information */}
          <section className="space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              Payment Information
            </h5>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Field
                label="Transaction ID"
                value={view.transactionId || '—'}
                icon={<Hash className="w-2.5 h-2.5 mr-1" />}
              />
              <Field
                label="Gateway Transaction ID"
                value={view.gatewayTransactionId || '—'}
                icon={<Hash className="w-2.5 h-2.5 mr-1" />}
              />
              <Field label="Payment Method" value={view.paymentMethod} />
              <Field
                label="Payment Date & Time"
                value={`${view.dateLabel}, ${view.timeLabel}`}
                icon={<CalendarClock className="w-2.5 h-2.5 mr-1" />}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
              <span className="uppercase text-slate-400 font-black">Payment Status:</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                  statusCls[view.paymentStatus] || statusCls.Cancelled
                }`}
              >
                {view.paymentStatus === 'Successful' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <CircleAlert className="w-3.5 h-3.5" />
                )}
                {view.paymentStatus}
              </span>
              <span className="text-slate-400">•</span>
              <span>
                Ticket entry:{' '}
                <strong className="text-slate-700">
                  {usedCount}/{view.tickets.length} used
                </strong>
              </span>
            </div>
          </section>

          {/* Ticket Information */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                Ticket Information ({view.tickets.length})
              </h5>
              <span className="text-[10px] text-slate-400 font-semibold">
                Purchased ticket list is never rewritten after scanning
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-center">Entry Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {!ticketsLoaded ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={`sk-${i}`}>
                          <td className="py-2.5 px-3" colSpan={4}>
                            <div className="h-3.5 w-full bg-slate-200/70 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      view.tickets.map((t) => (
                        <tr key={t.ticketId} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-mono font-black text-slate-900">
                            <span className="inline-block font-black text-[14px] text-blue-900 bg-gradient-to-r from-pink-300 to-green-300 border border-pink-400/40 px-1.5 py-0.5 rounded">
                              {t.displayId}
                            </span>
                            {t.seat && t.seat !== t.displayId ? (
                              <span className="ml-1.5 text-[10px] text-slate-400 font-sans font-bold">
                                seat {t.seat}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 px-3 font-bold">{t.category}</td>
                          <td className="py-2 px-3 text-right font-black">
                            {formatINR(t.price)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                entryCls[t.entryStatus] || entryCls.Unused
                              }`}
                            >
                              {t.entryStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Category Breakdown
              </span>
              <div className="space-y-1.5">
                {view.categories.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start justify-between gap-3 bg-white border border-slate-200/80 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-800">{c.name}:</span>
                      <span className="flex flex-wrap gap-1 mt-1">
                        {c.ticketIds.map((id) => (
                          <span
                            key={id}
                            className="font-mono font-black text-[14px] text-blue-900 bg-gradient-to-r from-pink-300 to-green-300 border border-pink-400/40 px-1.5 py-0.5 rounded"
                          >
                            {id}
                          </span>
                        ))}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-bold">
                        {c.count} {c.count === 1 ? 'ticket' : 'tickets'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                      {formatINR(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                <span className="font-black text-slate-600">Ticket Amount</span>
                <span className="font-black text-slate-900">
                  {formatINR(f.ticketAmount)}
                </span>
              </div>
            </div>
          </section>

          {/* Payment Breakdown */}
          <section className="space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              Payment Breakdown
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  Charges collected
                </span>
                <Row label="Ticket Amount" value={f.ticketAmount} bold />
                <Row label="GST" value={f.gst} />
                <Row label="Platform Charge" value={f.platformCharge} />
                <Row label="Convenience Fee" value={f.convenienceFee} />
                <Row label="Other Charges" value={f.otherCharges} />
                <Row label="Total Extra" value={f.totalExtraCharges} strong />
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                  <span className="font-black text-slate-800">Total Paid</span>
                  <span className="font-black text-base text-slate-900">
                    {formatINR(f.totalPaid)}
                  </span>
                </div>
              </div>

              <div className="bg-[#12193b] text-white rounded-2xl p-3.5 space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  Costs &amp; profit
                </span>
                <Row dark label="Payment Gateway Fee" value={f.paymentGatewayFee} />
                <Row dark label="Other Costs" value={f.otherCost} />
                <Row dark label="Actual Cost" value={f.actualCost} strong />
                <Row dark label="Retained Earnings" value={f.retainedEarnings} />
                <div className="flex items-center justify-between pt-1.5 border-t border-white/15">
                  <span className="font-black text-slate-300">Profit</span>
                  <span
                    className={`font-black text-base ${
                      f.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatINR(f.profit)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold pt-1">
                  Charges from{' '}
                  {f.chargeSource === 'stored'
                    ? 'stored transaction values'
                    : 'configured pricing rules'}
                  • Profit = retained earnings − actual costs
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {view.tickets.length} tickets • {usedCount} used
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download Receipt
            </button>
            <button
              onClick={() => handlePrint('invoice')}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Invoice
            </button>
            <button
              onClick={() => handlePrint('receipt')}
              className="flex items-center gap-1.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Payment Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  strong,
  dark,
}: {
  label: string;
  value: number;
  bold?: boolean;
  strong?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          strong || bold
            ? `font-black ${dark ? 'text-slate-200' : 'text-slate-800'}`
            : `${dark ? 'text-slate-400' : 'text-slate-500'} font-semibold`
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? `font-black ${dark ? 'text-white' : 'text-slate-900'}`
            : `${dark ? 'text-slate-200' : 'text-slate-800'} font-bold`
        }
      >
        {formatINR(value)}
      </span>
    </div>
  );
}
