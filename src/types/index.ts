export type NavigationTab = 
  | 'dashboard' 
  | 'events' 
  | 'tickets-types' 
  | 'bookings' 
  | 'tickets' 
  | 'payments' 
  | 'customers' 
  | 'counters' 
  | 'gates' 
  | 'reports' 
  | 'marketing' 
  | 'settings' 
  | 'users' 
  | 'logs' 
  | 'support';

export interface EventActor {
  name: string;
  photo: string;
}

export interface EventItem {
  id: string;
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

export interface BookingItem {
  id: string;
  eventId: string;
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
  paymentMethod: 'UPI' | 'Cash' | 'Card';
  transactionId?: string;
  time: string;
  date: string;
  status: 'Confirmed' | 'Checked-in' | 'Refunded' | 'Cancelled';
  assignedGate: string;
}

export interface GateInfo {
  id: string;
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
