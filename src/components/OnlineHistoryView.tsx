'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe,
  Search,
  Download,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  FilterX,
  TriangleAlert,
  Eye,
  Inbox,
} from 'lucide-react';
import {
  BookingItem,
  EventItem,
  PAYMENT_STATUSES,
  PaymentStatus,
  TicketType,
} from '@/types';
import * as fs from '@/lib/firestore';
import { formatINR, formatNumber } from '@/lib/utils';
import {
  DEFAULT_FILTERS,
  OnlineHistoryFilters,
  TransactionView,
  applyFilters,
  applySort,
  buildTransactionView,
  exportTransactionsCsv,
  hasActiveFilters,
  isOnlineTransaction,
  summarize,
} from '@/lib/onlineHistory';
import OnlineTransactionDetailsModal from '@/components/OnlineTransactionDetailsModal';
import SeatIcon from '@/components/SeatIcon';

interface OnlineHistoryViewProps {
  events: EventItem[];
  ticketTypes: TicketType[];
}

type Tone =
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'blue'
  | 'sky'
  | 'violet'
  | 'slate';

const TONES: Record<Tone, { pill: string; icon: string; bar: string }> = {
  indigo: { pill: 'bg-indigo-50 text-indigo-700', icon: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-500' },
  emerald: { pill: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500' },
  amber: { pill: 'bg-amber-50 text-amber-800', icon: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  red: { pill: 'bg-red-50 text-red-700', icon: 'bg-red-100 text-red-600', bar: 'bg-red-500' },
  blue: { pill: 'bg-blue-50 text-blue-700', icon: 'bg-blue-100 text-blue-600', bar: 'bg-blue-500' },
  sky: { pill: 'bg-sky-50 text-sky-700', icon: 'bg-sky-100 text-sky-600', bar: 'bg-sky-500' },
  violet: { pill: 'bg-violet-50 text-violet-700', icon: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500' },
  slate: { pill: 'bg-slate-100 text-slate-700', icon: 'bg-slate-200 text-slate-600', bar: 'bg-slate-400' },
};

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  Successful: 'emerald',
  Pending: 'amber',
  Failed: 'red',
  Refunded: 'blue',
  Cancelled: 'slate',
};

function SectionTitle({
  title,
  icon,
  hint,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <span className="text-indigo-600">{icon}</span>
        {title}
      </h3>
      {hint && <span className="text-[10px] text-slate-400 font-semibold">{hint}</span>}
    </div>
  );
}

function Skel({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200/70 rounded-xl animate-pulse ${className}`} />;
}

function ticketListLabel(ids: string[], max = 8): { text: string; extra: number } {
  if (ids.length <= max) return { text: ids.join(', '), extra: 0 };
  return { text: ids.slice(0, max).join(', '), extra: ids.length - max };
}

export default function OnlineHistoryView(_props: OnlineHistoryViewProps) {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [filters, setFilters] = useState<OnlineHistoryFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<TransactionView | null>(null);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;
    setLoading(true);
    setError(null);

    try {
      unsub = fs.listenAllBookings(
        (all) => {
          if (!active) return;
          setBookings(all);
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!active) return;
          setError(err?.message || 'Unable to load online payment history.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load online payment history.');
      setLoading(false);
    }

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [retryKey]);

  const transactions = useMemo(
    () =>
      bookings
        .filter(isOnlineTransaction)
        .map((b) => buildTransactionView(b)),
    [bookings]
  );

  const filtered = useMemo(
    () => applySort(applyFilters(transactions, filters), 'latest'),
    [transactions, filters]
  );

  const summary = useMemo(() => summarize(filtered), [filtered]);

  const setFilter = (patch: Partial<OnlineHistoryFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const hasFilters = hasActiveFilters(filters);
  const showEmpty = !loading && !error && filtered.length === 0;

  const statusCard = (status: PaymentStatus) => {
    const s = summary.statuses.find((x) => x.status === status);
    const tone = STATUS_TONE[status];
    const icons: Record<PaymentStatus, React.ReactNode> = {
      Successful: <CheckCircle2 className="w-4 h-4" />,
      Pending: <Clock className="w-4 h-4" />,
      Failed: <XCircle className="w-4 h-4" />,
      Refunded: <RotateCw className="w-4 h-4" />,
      Cancelled: <XCircle className="w-4 h-4" />,
    };
    return (
      <div
        key={status}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 relative overflow-hidden"
      >
        <span className={`absolute left-0 top-0 h-full w-1 ${TONES[tone].bar}`} />
        <div className="flex items-center gap-2.5 pl-1.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONES[tone].icon}`}>
            {icons[status]}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 block">
              {status}
            </span>
            <span className="text-lg font-black text-slate-900 leading-none block">
              {formatINR(s?.amount ?? 0)}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {formatNumber(s?.count ?? 0)}{' '}
              {(s?.count ?? 0) === 1 ? 'Transaction' : 'Transactions'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* ── 1. Page header ─────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Online History
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5 max-w-2xl">
            View and manage all online ticket bookings, payments, extra charges, and profit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-stretch lg:self-auto lg:justify-end">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              placeholder="Search txn / booking / name / mobile / ticket ID..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
              title="Reload online payment history"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              Reset Filters
            </button>
            <button
              onClick={() => exportTransactionsCsv(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export the filtered transaction-level records"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── Error state ────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-xs p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <TriangleAlert className="w-6 h-6" />
          </div>
          <p className="text-sm font-black text-slate-800">
            Unable to load online payment history.
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Financial totals are hidden until the transaction data loads successfully.
          </p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="mt-4 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Loading skeletons ──────────────────────────────────── */}
      {loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skel key={`s-${i}`} className="h-[74px] rounded-2xl" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`c-${i}`}
                className="w-full bg-white border border-slate-200 rounded-lg shadow-xs p-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <Skel className="h-3.5 w-48" />
                  <Skel className="h-5 w-5 rounded-lg" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Skel className="h-4 w-12 rounded" />
                  <Skel className="h-4 w-12 rounded" />
                  <Skel className="h-4 w-12 rounded" />
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <Skel className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Empty states ───────────────────────────────────────── */}
      {showEmpty && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-7 h-7" />
          </div>
          <p className="text-sm font-black text-slate-700">
            {hasFilters ? 'No transactions match your selected filters.' : 'No Online Payments Found'}
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1.5 max-w-md mx-auto">
            {hasFilters
              ? 'Try widening the date range or clearing the selected filters.'
              : 'Online payment transactions will appear here after customers complete bookings.'}
          </p>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* ── 1. Payment status summary ──────────────────────── */}
          <section>
            <SectionTitle
              title="Payment Status Summary"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              hint="Transaction count and amount per status"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {PAYMENT_STATUSES.map(statusCard)}
            </div>
          </section>

          {/* ── 2. Transaction cards ───────────────────────────── */}
          <section>
            <SectionTitle
              title="Online Payment History"
              icon={<Globe className="w-3.5 h-3.5" />}
              hint={`${filtered.length} transactions • ticket IDs never compressed`}
            />
            <div className="space-y-2">
              {filtered.map((t) => {
                const list = ticketListLabel(t.ticketIds);
                return (
                  <div
                    key={t.key}
                    className="w-full h-fit bg-white border border-slate-200 rounded-lg shadow-xs p-2 space-y-1"
                  >
                    <div className="flex items-center gap-x-2">
                      <span className="font-bold text-slate-800 text-[11px] whitespace-nowrap">
                        {t.dateLabel} • {t.timeLabel}
                      </span>

                      <div className="flex flex-wrap gap-1 justify-center pl-6 items-center flex-1 min-w-0">
                        {t.ticketIds.slice(0, 8).map((id) => (
                          <SeatIcon key={id} label={id} size="w-9 h-9" />
                        ))}
                        {list.extra > 0 && (
                          <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded whitespace-nowrap">
                            +{list.extra} more
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setSelected(t)}
                        title="View Details"
                        aria-label="View Details"
                        className="inline-flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                        <span className="font-bold text-slate-900 text-[11px] truncate">
                          {t.customerName}
                        </span>
                        <span className="font-mono font-black text-indigo-600 text-[10px]">
                          {t.transactionId || '—'}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {t.bookingId}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">{t.mobile}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-[9px] text-slate-400 font-black uppercase">
                        <span>
                          Qty
                        <span className="text-slate-800 ml-1.5 text-sm font-black">
                          {t.tickets.length}
                        </span>
                        </span>
                        <span>
                          Ticket Amt
                        <span className="text-slate-800 ml-1.5 text-sm font-black">
                          {formatINR(t.finance.ticketAmount)}
                        </span>
                        </span>
                        <span>
                          Processing Fees
                          <span className="text-amber-700 ml-1.5 text-sm font-black">
                          {formatINR(t.finance.totalExtraCharges)}
                        </span>
                        </span>
                        <span>
                          Total Paid
                        <span className="text-green-700 ml-1.5 text-sm font-black">
                          {formatINR(t.finance.totalPaid)}
                        </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <OnlineTransactionDetailsModal
        txn={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
