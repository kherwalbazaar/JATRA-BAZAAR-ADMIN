/**
 * Online History — transaction shaping, filtering, summaries, export & receipts.
 *
 * Every value shown in the Online History section is derived from the actual
 * transaction records (bookings) plus the configured financial rules in
 * `pricing.ts` / `finance.ts`. Nothing here stores or hardcodes sample data.
 */

import {
  BookingItem,
  EventItem,
  OnlineTicketRow,
  PAYMENT_STATUSES,
  PaymentStatus,
  TicketItem,
  TicketType,
} from '@/types';
import {
  TransactionFinance,
  computeTransactionFinance,
  resolvePaymentStatus,
} from './finance';
import { roundToPaise } from './pricing';
import { formatINR } from './utils';

// ─── Transaction identification ───────────────────────────────────

/** A transaction belongs to the Online History when it was paid online. */
export function isOnlineTransaction(booking: BookingItem): boolean {
  if (booking.source === 'Online') return true;
  if (booking.paymentChannel === 'Online') return true;
  if (booking.gatewayTransactionId) return true;
  if (booking.paymentStatus) return true;
  return false;
}

export function bookingReference(booking: BookingItem): string {
  return booking.ticketNumber || booking.bookingId || booking.id || '';
}

export function transactionReference(booking: BookingItem): string {
  return (
    (booking.transactionId || '').trim() ||
    (booking.gatewayTransactionId || '').trim() ||
    ''
  );
}

// ─── Date helpers ─────────────────────────────────────────────────

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function parseTransactionDate(booking: BookingItem): Date | null {
  return (
    parseDate(booking.paymentDate) ||
    parseDate(booking.createdAt as string) ||
    parseDate(`${booking.date || ''} ${booking.time || ''}`.trim()) ||
    parseDate(booking.date)
  );
}

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return localDayKey(dt);
}

export function transactionDayKey(txn: TransactionView): string {
  if (txn.timestamp) return localDayKey(new Date(txn.timestamp));
  const label = (txn.dateLabel || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  const parsed = parseDate(label);
  return parsed ? localDayKey(parsed) : '';
}

function formatDateTime(d: Date | null): { date: string; time: string } {
  if (!d) return { date: '', time: '' };
  return {
    date: d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };
}

// ─── Ticket rows (individual IDs — never compressed into a range) ─

const CANCELLED_STATUSES = ['CANCELLED', 'Cancelled'];

export function resolveTicketRows(
  booking: BookingItem,
  tickets?: TicketItem[]
): OnlineTicketRow[] {
  const count = Math.max(
    1,
    booking.quantity || (Array.isArray(booking.seats) ? booking.seats.length : 1)
  );
  const seats = Array.isArray(booking.seats) ? booking.seats : [];
  const usedTickets = new Set(
    (Array.isArray(booking.usedTickets) ? booking.usedTickets : []).map(String)
  );
  const usedSeats = new Set(
    (Array.isArray(booking.usedSeats) ? booking.usedSeats : []).map(String)
  );
  const isCancelled = booking.status === 'Cancelled' || booking.status === 'Refunded';
  const base = bookingReference(booking);
  const perTicketPrice =
    booking.unitPrice ??
    (booking.quantity ? roundToPaise((booking.ticketAmount ?? booking.amount ?? 0) / count) : 0);

  const entryFor = (ticketId: string, seat?: string | null): OnlineTicketRow['entryStatus'] => {
    if (isCancelled) return 'Cancelled';
    if (usedTickets.has(ticketId)) return 'Used';
    if (seat && usedSeats.has(seat)) return 'Used';
    if (count === 1 && booking.status === 'Checked-in') return 'Used';
    return 'Unused';
  };

  if (tickets && tickets.length > 0) {
    return tickets.map((t, i) => {
      const seat = t.seat ?? seats[i] ?? null;
      const ticketId = t.ticketId || t.id;
      return {
        ticketId,
        displayId: seat || ticketId,
        category: t.ticketTypeName || booking.ticketTypeName || 'General',
        price: t.unitPrice ?? booking.unitPrice ?? perTicketPrice,
        entryStatus:
          CANCELLED_STATUSES.includes(t.status)
            ? 'Cancelled'
            : t.status === 'ENTERED'
            ? 'Used'
            : entryFor(ticketId, seat),
        seat,
        scannedAt: t.scannedAt ?? null,
      };
    });
  }

  if (seats.length > 0) {
    return seats.map((seat, i) => {
      const ticketId = count === 1 ? base : `${base}-${i + 1}`;
      return {
        ticketId,
        displayId: seat,
        category: booking.ticketTypeName || 'General',
        price: booking.unitPrice ?? perTicketPrice,
        entryStatus: entryFor(ticketId, seat),
        seat,
        scannedAt: null,
      };
    });
  }

  return Array.from({ length: count }, (_, i) => {
    const ticketId = count === 1 ? base : `${base}-${i + 1}`;
    return {
      ticketId,
      displayId: ticketId,
      category: booking.ticketTypeName || 'General',
      price: booking.unitPrice ?? perTicketPrice,
      entryStatus: entryFor(ticketId, null),
      seat: count === 1 ? booking.seatNumber || null : null,
      scannedAt: null,
    };
  });
}

// ─── Transaction view model ───────────────────────────────────────

export interface CategoryGroup {
  name: string;
  count: number;
  amount: number;
  ticketIds: string[];
}

export interface TransactionView {
  key: string;
  booking: BookingItem;
  transactionId: string;
  bookingId: string;
  eventId: string;
  eventName: string;
  customerName: string;
  mobile: string;
  email: string;
  dateLabel: string;
  timeLabel: string;
  timestamp: number;
  tickets: OnlineTicketRow[];
  /** Display list of the purchased ticket IDs (A1, A2, A3 — never A1-A3). */
  ticketIds: string[];
  categories: CategoryGroup[];
  finance: TransactionFinance;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  gatewayTransactionId: string;
  searchText: string;
}

export function buildTransactionView(
  booking: BookingItem,
  tickets?: TicketItem[]
): TransactionView {
  const rows = resolveTicketRows(booking, tickets);
  const finance = computeTransactionFinance(booking);
  const paymentStatus = resolvePaymentStatus(booking);
  const parsed = parseTransactionDate(booking);
  const fallback = formatDateTime(parsed);

  const categoryMap = new Map<string, CategoryGroup>();
  for (const row of rows) {
    const name = row.category || 'General';
    const group = categoryMap.get(name) || {
      name,
      count: 0,
      amount: 0,
      ticketIds: [],
    };
    group.count += 1;
    group.amount = roundToPaise(group.amount + (row.price || 0));
    group.ticketIds.push(row.displayId);
    categoryMap.set(name, group);
  }
  const categories = Array.from(categoryMap.values());
  if (categories.length === 1) {
    // Single-category transaction: the group amount is the exact ticket amount.
    categories[0].amount = finance.ticketAmount;
  }

  const transactionId = transactionReference(booking);
  const bookingId = bookingReference(booking);
  const ticketIds = rows.map((r) => r.displayId);

  const searchText = [
    transactionId,
    bookingId,
    booking.id,
    booking.customerName,
    booking.customerPhone,
    booking.customerEmail || '',
    booking.eventName || '',
    booking.ticketTypeName || '',
    ...ticketIds,
    ...rows.map((r) => r.ticketId),
    ...(Array.isArray(booking.seats) ? booking.seats : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    key: booking.id,
    booking,
    transactionId,
    bookingId,
    eventId: booking.eventId || '',
    eventName: booking.eventName || '',
    customerName: booking.customerName || '—',
    mobile: booking.customerPhone || '—',
    email: booking.customerEmail || '',
    dateLabel: booking.date || fallback.date || '—',
    timeLabel: booking.time || fallback.time || '—',
    timestamp: parsed ? parsed.getTime() : 0,
    tickets: rows,
    ticketIds,
    categories,
    finance,
    paymentMethod: booking.paymentMethod || 'Other',
    paymentStatus,
    gatewayTransactionId: booking.gatewayTransactionId || '',
    searchText,
  };
}

// ─── Filters & sorting ────────────────────────────────────────────

export type DateRangeKey = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface OnlineHistoryFilters {
  search: string;
  dateRange: DateRangeKey;
  customFrom: string;
  customTo: string;
  eventId: string;
  category: string;
  paymentStatus: string;
  paymentMethod: string;
}

export const DEFAULT_FILTERS: OnlineHistoryFilters = {
  search: '',
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  eventId: '',
  category: '',
  paymentStatus: '',
  paymentMethod: '',
};

export type SortKey =
  | 'latest'
  | 'oldest'
  | 'amountHigh'
  | 'amountLow'
  | 'profitHigh'
  | 'profitLow'
  | 'ticketsHigh'
  | 'ticketsLow'
  | 'customer';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'latest', label: 'Latest transaction' },
  { key: 'oldest', label: 'Oldest transaction' },
  { key: 'amountHigh', label: 'Highest amount' },
  { key: 'amountLow', label: 'Lowest amount' },
  { key: 'profitHigh', label: 'Highest profit' },
  { key: 'profitLow', label: 'Lowest profit' },
  { key: 'ticketsHigh', label: 'Most tickets' },
  { key: 'ticketsLow', label: 'Fewest tickets' },
  { key: 'customer', label: 'Customer name' },
];

export function hasActiveFilters(filters: OnlineHistoryFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.dateRange !== 'all' ||
    filters.eventId !== '' ||
    filters.category !== '' ||
    filters.paymentStatus !== '' ||
    filters.paymentMethod !== ''
  );
}

function withinDateRange(txn: TransactionView, filters: OnlineHistoryFilters): boolean {
  if (filters.dateRange === 'all') return true;
  const key = transactionDayKey(txn);
  if (!key) return true;

  const today = localDayKey(new Date());
  if (filters.dateRange === 'today') return key === today;
  if (filters.dateRange === 'yesterday') return key === shiftDayKey(today, -1);
  if (filters.dateRange === '7d') return key >= shiftDayKey(today, -6) && key <= today;
  if (filters.dateRange === '30d') return key >= shiftDayKey(today, -29) && key <= today;
  if (filters.dateRange === 'custom') {
    if (filters.customFrom && key < filters.customFrom) return false;
    if (filters.customTo && key > filters.customTo) return false;
    return true;
  }
  return true;
}

export function applyFilters(
  list: TransactionView[],
  filters: OnlineHistoryFilters
): TransactionView[] {
  const q = filters.search.trim().toLowerCase();
  return list.filter((txn) => {
    if (!withinDateRange(txn, filters)) return false;
    if (filters.eventId && txn.eventId !== filters.eventId) return false;
    if (filters.paymentStatus && txn.paymentStatus !== filters.paymentStatus) return false;
    if (filters.paymentMethod && txn.paymentMethod !== filters.paymentMethod) return false;
    if (filters.category && !txn.categories.some((c) => c.name === filters.category)) {
      return false;
    }
    if (q && !txn.searchText.includes(q)) return false;
    return true;
  });
}

export function applySort(list: TransactionView[], sort: SortKey): TransactionView[] {
  const out = [...list];
  const amount = (t: TransactionView) => t.finance.totalPaid;
  switch (sort) {
    case 'oldest':
      out.sort((a, b) => a.timestamp - b.timestamp);
      break;
    case 'amountHigh':
      out.sort((a, b) => amount(b) - amount(a));
      break;
    case 'amountLow':
      out.sort((a, b) => amount(a) - amount(b));
      break;
    case 'profitHigh':
      out.sort((a, b) => b.finance.profit - a.finance.profit);
      break;
    case 'profitLow':
      out.sort((a, b) => a.finance.profit - b.finance.profit);
      break;
    case 'ticketsHigh':
      out.sort((a, b) => b.tickets.length - a.tickets.length);
      break;
    case 'ticketsLow':
      out.sort((a, b) => a.tickets.length - b.tickets.length);
      break;
    case 'customer':
      out.sort((a, b) => a.customerName.localeCompare(b.customerName));
      break;
    case 'latest':
    default:
      out.sort((a, b) => b.timestamp - a.timestamp || b.key.localeCompare(a.key));
      break;
  }
  return out;
}

// ─── Options ──────────────────────────────────────────────────────

export function collectCategoryOptions(
  list: TransactionView[],
  ticketTypes?: TicketType[]
): string[] {
  const names = new Set<string>();
  for (const t of list) t.categories.forEach((c) => names.add(c.name));
  (ticketTypes || []).forEach((t) => t.name && names.add(t.name));
  return Array.from(names).sort((a, b) => {
    const rank = (n: string) => {
      const u = n.trim().toUpperCase();
      if (u === 'VIP') return 0;
      if (u === 'SPL') return 1;
      return 2;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

export function collectEventOptions(
  list: TransactionView[],
  events: EventItem[]
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  events.forEach((e) => map.set(e.id, e.title || e.eventTitle || e.id));
  list.forEach((t) => {
    if (t.eventId && !map.has(t.eventId)) {
      map.set(t.eventId, t.eventName || t.eventId);
    }
  });
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function matchesCategoryAlias(name: string, alias: string): boolean {
  const n = (name || '').trim().toUpperCase();
  return n === alias || n.startsWith(`${alias} `) || n.startsWith(`${alias}-`);
}

// ─── Summaries (always derived from the filtered transaction list) ─

export interface CategoryTotal {
  name: string;
  count: number;
  amount: number;
}

export interface StatusTotal {
  status: PaymentStatus;
  count: number;
  amount: number;
}

export interface OnlineHistorySummary {
  transactionCount: number;
  totalTickets: number;
  vipTickets: number;
  splTickets: number;
  otherTickets: number;
  categories: CategoryTotal[];
  totalAmount: number;
  extraCharges: number;
  totalProfit: number;
  amountReceived: number;
  gst: number;
  platformCharge: number;
  convenienceFee: number;
  otherCharges: number;
  paymentGatewayFee: number;
  otherCost: number;
  actualCost: number;
  retainedEarnings: number;
  totalPaidAll: number;
  statuses: StatusTotal[];
}

export function summarize(list: TransactionView[]): OnlineHistorySummary {
  const categories = new Map<string, CategoryTotal>();
  const statuses = new Map<PaymentStatus, StatusTotal>();

  PAYMENT_STATUSES.forEach((s) =>
    statuses.set(s, { status: s, count: 0, amount: 0 })
  );

  const summary: OnlineHistorySummary = {
    transactionCount: list.length,
    totalTickets: 0,
    vipTickets: 0,
    splTickets: 0,
    otherTickets: 0,
    categories: [],
    totalAmount: 0,
    extraCharges: 0,
    totalProfit: 0,
    amountReceived: 0,
    gst: 0,
    platformCharge: 0,
    convenienceFee: 0,
    otherCharges: 0,
    paymentGatewayFee: 0,
    otherCost: 0,
    actualCost: 0,
    retainedEarnings: 0,
    totalPaidAll: 0,
    statuses: Array.from(statuses.values()),
  };

  for (const txn of list) {
    const f = txn.finance;
    summary.totalTickets += txn.tickets.length;
    summary.totalAmount = roundToPaise(summary.totalAmount + f.ticketAmount);
    summary.extraCharges = roundToPaise(summary.extraCharges + f.totalExtraCharges);
    summary.totalProfit = roundToPaise(summary.totalProfit + f.profit);
    summary.gst = roundToPaise(summary.gst + f.gst);
    summary.platformCharge = roundToPaise(summary.platformCharge + f.platformCharge);
    summary.convenienceFee = roundToPaise(summary.convenienceFee + f.convenienceFee);
    summary.otherCharges = roundToPaise(summary.otherCharges + f.otherCharges);
    summary.paymentGatewayFee = roundToPaise(
      summary.paymentGatewayFee + f.paymentGatewayFee
    );
    summary.otherCost = roundToPaise(summary.otherCost + f.otherCost);
    summary.actualCost = roundToPaise(summary.actualCost + f.actualCost);
    summary.retainedEarnings = roundToPaise(summary.retainedEarnings + f.retainedEarnings);
    summary.totalPaidAll = roundToPaise(summary.totalPaidAll + f.totalPaid);
    if (txn.paymentStatus === 'Successful') {
      summary.amountReceived = roundToPaise(summary.amountReceived + f.totalPaid);
    }

    const st = statuses.get(txn.paymentStatus);
    if (st) {
      st.count += 1;
      st.amount = roundToPaise(st.amount + f.totalPaid);
    }

    for (const c of txn.categories) {
      const existing = categories.get(c.name) || { name: c.name, count: 0, amount: 0 };
      existing.count += c.count;
      existing.amount = roundToPaise(existing.amount + c.amount);
      categories.set(c.name, existing);
    }
  }

  const categoryList = Array.from(categories.values());
  for (const c of categoryList) {
    if (matchesCategoryAlias(c.name, 'VIP')) summary.vipTickets += c.count;
    else if (matchesCategoryAlias(c.name, 'SPL')) summary.splTickets += c.count;
  }
  summary.otherTickets = Math.max(
    0,
    summary.totalTickets - summary.vipTickets - summary.splTickets
  );
  summary.categories = categoryList.sort((a, b) => {
    const rank = (n: string) =>
      matchesCategoryAlias(n, 'VIP') ? 0 : matchesCategoryAlias(n, 'SPL') ? 1 : 2;
    return rank(a.name) - rank(b.name) || b.count - a.count || a.name.localeCompare(b.name);
  });
  summary.statuses = PAYMENT_STATUSES.map(
    (s) => statuses.get(s) || { status: s, count: 0, amount: 0 }
  );

  return summary;
}

// ─── Export (transaction-level records) ───────────────────────────

const CSV_HEADERS = [
  'Date',
  'Time',
  'Transaction ID',
  'Booking ID',
  'Customer Name',
  'Mobile',
  'Email',
  'Event',
  'Ticket IDs',
  'Ticket Category',
  'Ticket Amount',
  'GST',
  'Platform Charge',
  'Convenience Fee',
  'Payment Gateway Fee',
  'Other Charges',
  'Total Extra',
  'Total Paid',
  'Actual Cost',
  'Profit',
  'Payment Method',
  'Payment Status',
];

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function exportTransactionsCsv(list: TransactionView[]): void {
  const lines: string[] = [CSV_HEADERS.map(csvCell).join(',')];

  for (const t of list) {
    const f = t.finance;
    lines.push(
      [
        t.dateLabel,
        t.timeLabel,
        t.transactionId || '—',
        t.bookingId,
        t.customerName,
        t.mobile,
        t.email,
        t.eventName,
        t.ticketIds.join(', '),
        t.categories.map((c) => `${c.name} (${c.count})`).join(', '),
        f.ticketAmount,
        f.gst,
        f.platformCharge,
        f.convenienceFee,
        f.paymentGatewayFee,
        f.otherCharges,
        f.totalExtraCharges,
        f.totalPaid,
        f.actualCost,
        f.profit,
        t.paymentMethod,
        t.paymentStatus,
      ]
        .map(csvCell)
        .join(',')
    );
  }

  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jatra_online_history_${localDayKey(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Receipt / invoice ────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReceiptHtml(
  txn: TransactionView,
  kind: 'receipt' | 'invoice'
): string {
  const f = txn.finance;
  const title = kind === 'invoice' ? 'TAX INVOICE' : 'PAYMENT RECEIPT';
  const money = (v: number) => formatINR(v);

  const ticketRows = txn.tickets
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.displayId)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td class="num">${money(t.price)}</td>
        <td class="center">${escapeHtml(t.entryStatus)}</td>
      </tr>`
    )
    .join('');

  const categoryRows = txn.categories
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td class="num">${c.count}</td>
        <td class="num">${money(c.amount)}</td>
        <td>${escapeHtml(c.ticketIds.join(', '))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} — ${escapeHtml(txn.transactionId || txn.bookingId)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
  .sheet { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f39f6; padding-bottom: 12px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: .5px; }
  .brand { font-size: 13px; font-weight: 700; color: #4f39f6; }
  .badge { background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; margin-top: 16px; font-size: 12px; }
  .grid div span { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; }
  .grid div strong { font-size: 13px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .8px; color: #475569; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
  .num { text-align: right; white-space: nowrap; }
  .center { text-align: center; }
  .totals { width: 320px; margin-left: auto; margin-top: 12px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; }
  .totals div.grand { font-weight: 800; font-size: 15px; border-bottom: none; border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 8px; }
  .ok { color: #047857; font-weight: 800; }
  footer { margin-top: 26px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div>
      <div class="brand">JATRA BAZAAR</div>
      <h1>${title}</h1>
    </div>
    <div class="badge">${escapeHtml(txn.paymentStatus)}</div>
  </header>

  <div class="grid">
    <div><span>Event</span><strong>${escapeHtml(txn.eventName || '—')}</strong></div>
    <div><span>Customer</span><strong>${escapeHtml(txn.customerName)}</strong></div>
    <div><span>Transaction ID</span><strong>${escapeHtml(txn.transactionId || '—')}</strong></div>
    <div><span>Booking ID</span><strong>${escapeHtml(txn.bookingId)}</strong></div>
    <div><span>Mobile</span><strong>${escapeHtml(txn.mobile)}</strong></div>
    <div><span>Email</span><strong>${escapeHtml(txn.email || '—')}</strong></div>
    <div><span>Payment Method</span><strong>${escapeHtml(txn.paymentMethod)}</strong></div>
    <div><span>Date &amp; Time</span><strong>${escapeHtml(txn.dateLabel)}, ${escapeHtml(txn.timeLabel)}</strong></div>
    ${
      txn.gatewayTransactionId
        ? `<div><span>Gateway Reference</span><strong>${escapeHtml(txn.gatewayTransactionId)}</strong></div>`
        : ''
    }
  </div>

  <h2>Tickets &amp; Categories</h2>
  <table>
    <thead><tr><th>Ticket</th><th>Category</th><th class="num">Price</th><th class="center">Entry Status</th></tr></thead>
    <tbody>${ticketRows}</tbody>
  </table>

  <h2>Category Summary</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Qty</th><th class="num">Amount</th><th>Ticket IDs</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>Payment Breakdown</h2>
  <div class="totals">
    <div><span>Ticket Amount</span><strong>${money(f.ticketAmount)}</strong></div>
    <div><span>GST</span><strong>${money(f.gst)}</strong></div>
    <div><span>Platform Charge</span><strong>${money(f.platformCharge)}</strong></div>
    <div><span>Convenience Fee</span><strong>${money(f.convenienceFee)}</strong></div>
    <div><span>Other Charges</span><strong>${money(f.otherCharges)}</strong></div>
    <div><span>Total Extra</span><strong>${money(f.totalExtraCharges)}</strong></div>
    <div class="grand"><span>Total Paid</span><strong>${money(f.totalPaid)}</strong></div>
    <div><span>Actual Cost</span><strong>${money(f.actualCost)}</strong></div>
    <div><span>Profit</span><strong>${money(f.profit)}</strong></div>
  </div>

  <footer>
    Payment status: <span class="ok">${escapeHtml(txn.paymentStatus)}</span> ·
    Generated on ${new Date().toLocaleString('en-IN')} · JATRA BAZAAR Admin
  </footer>
</div>
</body>
</html>`;
}

export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  };
  setTimeout(trigger, 300);
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
