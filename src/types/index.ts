export type NavigationTab =
  | 'dashboard'
  | 'events'
  | 'tickets-types'
  | 'create-seat'
  | 'diagram'
  | 'counter-booking'
  | 'bookings'
  | 'tickets'
  | 'scanner-members'
  | 'scan-history'
  | 'online-history'
  | 'payments'
  | 'customers'
  | 'settings'
  | 'logs';

export interface EventActor {
  name: string;
  photo: string;
}

export interface EventItem {
  id: string;
  showId?: string;
  eventId?: string;
  title: string;
  subtitle: string;
  date: string;
  day: string;
  time: string;
  venue: string;
  city: string;
  status: 'active' | 'upcoming' | 'completed' | 'sold_out';
  poster: string;
  totalCapacity: number;
  ticketsSold: number;
  totalRevenue: number;
  organizer: string;
  description: string;

  // Event/festival title (e.g. PARBON PATA, Durga Puja)
  eventTitle?: string;

  // 1. Event Details
  committeeName?: string;
  committeeLocation?: string;
  partyName?: string;
  language?: string;
  audience?: string;
  year?: string;
  month?: string;
  dayOfMonth?: string;

  // 2. Date & Time
  entryTime?: string;
  startTime?: string;
  eventTime?: string;
  endTime?: string;
  duration?: string;

  // 3. Location & Contact
  address?: string;
  phone?: string;

  // 4. Cast & Crew
  actors?: EventActor[];

  // 5. Banner
  additionalBanners?: string[];

  // 6. Creative
  writer?: string;
  director?: string;
  musicDirector?: string;
  singer?: string;

  // 7. Trailer
  trailerUrl?: string;

  // Ticket selling channel
  saleMode?: 'Online' | 'Counter';
}

export interface TicketType {
  id: string;
  name: string;
  committeeName?: string;
  blocks?: string[];
  /** Row letters (A, B, C…) this tier covers — empty/omitted = every row. */
  rows?: string[];
  badgeText?: string;
  price: number;
  totalQuota: number;
  sold: number;
  color: string;
  bgColor: string;
  textColor: string;
  perks: string[];
  gateAccess: string[];
}

export interface Seat {
  id: string;
  eventId: string;
  blockId: string;
  rowId: string;
  seatNumber: number;
  seatLabel: string;
  status: 'available' | 'booked';
  price?: number;
  createdAt?: string;
  bookedAt?: string | null;
}

export type TicketStatus = 'ACTIVE' | 'ENTERED' | 'CANCELLED';

// ─── Online payment history ───────────────────────────────────────

export type PaymentStatus = 'Successful' | 'Pending' | 'Failed' | 'Refunded' | 'Cancelled';

export type PaymentMethod = 'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Wallet' | 'Other';

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Successful',
  'Pending',
  'Failed',
  'Refunded',
  'Cancelled',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Card',
  'Net Banking',
  'Wallet',
  'Cash',
  'Other',
];

// Per-ticket entry rows used by the Online History transaction details.
export interface OnlineTicketRow {
  ticketId: string;
  displayId: string;
  category: string;
  price: number;
  entryStatus: 'Used' | 'Unused' | 'Cancelled';
  seat?: string | null;
  scannedAt?: string | null;
}

export interface TicketItem {
  id: string; // e.g. NJ26-00001-1
  ticketId: string; // e.g. NJ26-00001-1
  bookingId: string; // e.g. NJ26-00001
  bookingDocId?: string;
  ticketIndex: number;
  totalTickets: number;
  eventId: string;
  eventName: string;
  ticketTypeId: string;
  ticketTypeName: string;
  seat?: string | null;
  seatIndex?: number;
  seatCount?: number;
  block?: string | null;
  assignedGate: string;
  customerName: string;
  customerPhone: string;
  serialNumber: string;
  qrToken: string;
  status: TicketStatus;
  date: string;
  time: string;
  unitPrice?: number;
  scannedAt?: string | null;
  scannedBy?: string | null;
  scannerMemberId?: string | null;
  scannerMemberName?: string | null;
  scanGateId?: string | null;
  scanDate?: string | null;
  scanTime?: string | null;
  createdAt: string;
}

export interface BookingItem {
  id: string;
  bookingId?: string;
  showId?: string;
  eventId: string;
  eventName?: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  source: 'Online' | 'Counter';
  counterName?: string;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  time: string;
  date: string;
  status: 'Confirmed' | 'Checked-in' | 'Refunded' | 'Cancelled' | 'Used';
  bookingStatus?: 'Confirmed' | 'Cancelled';
  assignedGate: string;
  block?: string;
  seats?: string[];
  seatNumber?: string;
  seatCount?: number;
  usedTickets?: string[];
  usedSeats?: string[];
  usedCount?: number;
  enteredCount?: number;
  remainingCount?: number;
  usedAt?: string;

  // Gateway-independent charge breakdown
  ticketAmount?: number;
  baseAmount?: number;
  convenienceFee?: number;
  gstOnConvenienceFee?: number;
  platformCharge?: number;
  totalFees?: number;
  finalCustomerAmount?: number;

  // Online payment / transaction metadata
  paymentStatus?: PaymentStatus;
  paymentChannel?: 'Online' | 'Counter';
  gatewayTransactionId?: string;
  paymentDate?: string; // ISO
  /** Explicit purchased ticket IDs (never rewritten after scanning). */
  ticketIds?: string[];
  createdAt?: string; // ISO
  /** Charge/ cost fields that may be stored on the transaction by the payment layer. */
  otherCharges?: number;
  gatewayFee?: number;
  actualCost?: number;
  profit?: number;
}

export interface GateInfo {
  id: string;
  eventId?: string;
  name: string;
  entered: number;
  capacity: number;
  percentage: number;
  color: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
  barColor: string;
  status: 'normal' | 'congested' | 'full';
  assignedTicketTypes: string[];
}

export interface CounterBooth {
  id: string;
  name: string;
  operatorName: string;
  status: 'online' | 'busy' | 'offline';
  ticketsSold: number;
  cashAmount: number;
  upiAmount: number;
  totalAmount: number;
  lastActive: string;
}

export interface KPIStats {
  totalTicketsSold: number;
  totalCollection: number;
  ticketsRemaining: number;
  totalCapacity: number;
  peopleEntered: number;
  todayCollection: number;
  todayPercentageOfTotal: number;
  onlineCollection: number;
  offlineCollection: number;
  cashCollection: number;
  upiCollection: number;
  averageTicketValue: number;
  scannedTodayPercentage: number;
}

// ─── Scanner system ───────────────────────────────────────────────

export type ScannerApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ScannerAccountStatus = 'active' | 'deactivated';

export interface ScannerMember {
  id: string;
  scannerId: string; // SCN-001
  name: string;
  email: string;
  mobile: string;
  profilePhoto: string;
  approvalStatus: ScannerApprovalStatus;
  accountStatus: ScannerAccountStatus;
  assignedGateId?: string;
  address?: string;
  idProof?: string;
  notes?: string;
  createdAt: string; // ISO
  approvedAt?: string;
  approvedBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  lastScanAt?: string;
  totalScans: number;
}

export type ScanResult =
  | 'SUCCESS'
  | 'ALREADY_USED'
  | 'INVALID'
  | 'CANCELLED'
  | 'UNPAID'
  | 'WRONG_EVENT'
  | 'SCANNER_DENIED';

export interface IdentifiedBooking {
  status: 'FOUND' | 'ALREADY_USED' | 'CANCELLED' | 'WRONG_EVENT' | 'UNPAID' | 'INVALID';
  message?: string;
  booking?: BookingItem;
  tickets?: TicketItem[];
  preselectedTicketId?: string;
  rejectedTicket?: {
    ticketId: string;
    seat?: string;
    entryTime?: string;
    scannerId?: string;
    scannerName?: string;
  };
}

export interface BatchEntryResult {
  result: ScanResult;
  message?: string;
  admittedTickets: TicketItem[];
  admittedCount: number;
  remainingCount: number;
  totalTickets: number;
  bookingId: string;
  audienceName: string;
  ticketType?: string;
  gateId?: string;
  entryTime?: string;
  scanTime?: string;
  scanDate?: string;
  scannedAt?: string;
  scannerId?: string;
  scannerName?: string;
}

export interface EntryResult {
  result: ScanResult;
  ticketId?: string;
  bookingId?: string;
  audienceName?: string;
  seat?: string;
  block?: string;
  persons?: number;
  ticketType?: string;
  bookingSource?: string;
  eventName?: string;
  gateId?: string;
  entryTime?: string;
  scannedAt?: string;
  scannerId?: string;
  scannerName?: string;
  previousEntryTime?: string;
  previousScannerId?: string;
  previousScannerName?: string;
  previousGateId?: string;
  message?: string;
}

export interface TicketEntry {
  id: string;
  ticketId: string; // booking.ticketNumber or individual ticketId
  eventId: string;
  scannerId: string; // SCN-001
  memberId: string; // scannerMembers doc id
  scannerName: string;
  gateId: string;
  entryStatus: 'entered' | 'rejected';
  scanResult: ScanResult;
  scannedAt: string; // ISO
  scanDate?: string; // YYYY-MM-DD local
  scanTime?: string; // e.g. 11:42:15 PM
  bookingId?: string;
  audienceName?: string;
  persons?: number;
  ticketType?: string;
  bookingSource?: string;
  previousEntryTime?: string;
  previousScannerId?: string;
  previousScannerName?: string;
  previousGateId?: string;
  ticketNumber?: string;
  baseTicketId?: string;
  seat?: string;
  seatIndex?: number;
}

export interface AuditLog {
  id: string;
  action: string; // scanner.approved | scanner.rejected | scanner.activated | scanner.deactivated | entry.accepted | entry.rejected | scanner.added
  performedBy: string;
  targetId: string;
  timestamp: string; // ISO
  metadata?: Record<string, string | number | boolean>;
}
