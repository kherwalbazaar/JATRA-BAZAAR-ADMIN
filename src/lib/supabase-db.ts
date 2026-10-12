import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const sb = createClient(supabaseUrl, supabaseKey);

// ─── Fire-and-forget helpers ─────────────────────────────────────
// These NEVER throw and NEVER block the Firebase write.
// They run AFTER the Firebase write succeeds (via .then()).

function logFail(table: string, op: string, err: unknown) {
  console.warn(`[supabase-mirror] ${op} on ${table} failed:`, err);
}

/** Upsert a row (insert or update by id). */
export function sbUpsert(table: string, data: Record<string, unknown>): void {
  sb.from(table)
    .upsert(data)
    .then(({ error }) => {
      if (error) logFail(table, 'upsert', error.message);
    });
}

/** Upsert many rows at once. */
export function sbUpsertMany(table: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  sb.from(table)
    .upsert(rows)
    .then(({ error }) => {
      if (error) logFail(table, 'upsertMany', error.message);
    });
}

/** Update a row by id. */
export function sbUpdate(table: string, id: string, data: Record<string, unknown>): void {
  sb.from(table)
    .update(data)
    .eq('id', id)
    .then(({ error }) => {
      if (error) logFail(table, 'update', error.message);
    });
}

/** Delete a row by id. */
export function sbDelete(table: string, id: string): void {
  sb.from(table)
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) logFail(table, 'delete', error.message);
    });
}

/** Delete rows matching a filter. */
export function sbDeleteWhere(table: string, column: string, value: unknown): void {
  sb.from(table)
    .delete()
    .eq(column, value)
    .then(({ error }) => {
      if (error) logFail(table, 'deleteWhere', error.message);
    });
}

/**
 * Convert a Firestore payload to a Supabase-safe row.
 * - Strips undefined values (Supabase rejects them)
 * - Converts nested objects/arrays to JSONB-compatible values
 * - Converts Firestore Timestamp objects to ISO strings
 * - Converts null → null (kept as-is)
 */
export function sbCleanRow(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (val === null) { out[key] = null; continue; }
    // Firestore Timestamp → ISO string
    if (typeof val === 'object' && val !== null && 'toDate' in (val as any) && typeof (val as any).toDate === 'function') {
      out[key] = (val as any).toDate().toISOString();
      continue;
    }
    // Firestore Timestamp with seconds/nanoseconds
    if (typeof val === 'object' && val !== null && 'seconds' in (val as any) && 'nanoseconds' in (val as any)) {
      const ts = val as { seconds: number; nanoseconds: number };
      out[key] = new Date(ts.seconds * 1000).toISOString();
      continue;
    }
    // Arrays and plain objects pass through (Supabase maps to jsonb)
    out[key] = val;
  }
  return out;
}

/**
 * Map a Firestore booking/ticket/seat payload to snake_case Supabase columns.
 * Only maps known fields — unknown fields are dropped silently.
 */
const BOOKING_FIELD_MAP: Record<string, string> = {
  showId: 'show_id',
  eventId: 'event_id',
  eventName: 'event_name',
  ticketNumber: 'ticket_number',
  ticketTypeId: 'ticket_type_id',
  ticketTypeName: 'ticket_type_name',
  customerName: 'customer_name',
  customerPhone: 'customer_phone',
  customerEmail: 'customer_email',
  unitPrice: 'unit_price',
  ticketAmount: 'ticket_amount',
  baseAmount: 'base_amount',
  convenienceFee: 'convenience_fee',
  gstOnConvenienceFee: 'gst_on_convenience_fee',
  platformCharge: 'platform_charge',
  totalFees: 'total_fees',
  finalCustomerAmount: 'final_customer_amount',
  paymentMethod: 'payment_method',
  transactionId: 'transaction_id',
  bookingDate: 'booking_date',
  bookingTime: 'booking_time',
  bookingStatus: 'booking_status',
  enteredCount: 'entered_count',
  remainingCount: 'remaining_count',
  assignedGate: 'assigned_gate',
  seatCount: 'seat_count',
  seatNumber: 'seat_number',
  usedTickets: 'used_tickets',
  usedSeats: 'used_seats',
  usedCount: 'used_count',
  // keep same-name fields: id, quantity, amount, source, time, date, status, block, seats, createdAt → created_at handled separately
};

const TICKET_FIELD_MAP: Record<string, string> = {
  ticketId: 'ticket_id',
  bookingId: 'booking_id',
  bookingDocId: 'booking_doc_id',
  ticketIndex: 'ticket_index',
  totalTickets: 'total_tickets',
  showId: 'show_id',
  eventId: 'event_id',
  eventName: 'event_name',
  ticketTypeId: 'ticket_type_id',
  ticketTypeName: 'ticket_type_name',
  seatIndex: 'seat_index',
  seatCount: 'seat_count',
  assignedGate: 'assigned_gate',
  customerName: 'customer_name',
  customerPhone: 'customer_phone',
  serialNumber: 'serial_number',
  qrToken: 'qr_token',
  unitPrice: 'unit_price',
  scannedAt: 'scanned_at',
  scannedBy: 'scanned_by',
  scannerMemberId: 'scanner_member_id',
  scannerMemberName: 'scanner_member_name',
  scanGateId: 'scan_gate_id',
  scanDate: 'scan_date',
  scanTime: 'scan_time',
  cancelledAt: 'cancelled_at',
};

const SEAT_FIELD_MAP: Record<string, string> = {
  seatId: 'seat_id',
  showId: 'show_id',
  eventId: 'event_id',
  blockId: 'block_id',
  rowId: 'row_id',
  seatNumber: 'seat_number',
  seatLabel: 'seat_label',
  ticketTypeId: 'ticket_type_id',
  reservedBy: 'reserved_by',
  reservedAt: 'reserved_at',
  bookedAt: 'booked_at',
};

const EVENT_FIELD_MAP: Record<string, string> = {
  eventTitle: 'event_title',
  committeeName: 'committee_name',
  committeeLocation: 'committee_location',
  partyName: 'party_name',
  saleMode: 'sale_mode',
  startTime: 'start_time',
  endTime: 'end_time',
  entryTime: 'entry_time',
  additionalBanners: 'additional_banners',
  musicDirector: 'music_director',
  trailerUrl: 'trailer_url',
  imageUrl: 'image_url',
  showId: 'show_id',
  eventId: 'event_id',
  dayOfMonth: 'day_of_month',
};

const SCANNER_FIELD_MAP: Record<string, string> = {
  scannerId: 'scanner_id',
  approvalStatus: 'approval_status',
  accountStatus: 'account_status',
  profilePhoto: 'profile_photo',
  gateId: 'gate_id',
  eventId: 'event_id',
  totalScans: 'total_scans',
  lastScanAt: 'last_scan_at',
};

const ENTRY_FIELD_MAP: Record<string, string> = {
  eventId: 'event_id',
  scannerId: 'scanner_id',
  memberId: 'member_id',
  scannerName: 'scanner_name',
  gateId: 'gate_id',
  ticketId: 'ticket_id',
  bookingId: 'booking_id',
  ticketNumber: 'ticket_number',
  entryStatus: 'entry_status',
  scanResult: 'scan_result',
  scannedAt: 'scanned_at',
  audienceName: 'audience_name',
  ticketType: 'ticket_type',
  previousEntryTime: 'previous_entry_time',
  previousScannerId: 'previous_scanner_id',
  previousScannerName: 'previous_scanner_name',
  previousGateId: 'previous_gate_id',
  bookingSource: 'booking_source',
  scanDate: 'scan_date',
  scanTime: 'scan_time',
};

const GATE_FIELD_MAP: Record<string, string> = {
  eventId: 'event_id',
};

const TICKET_TYPE_FIELD_MAP: Record<string, string> = {
  eventId: 'event_id',
  showId: 'show_id',
  displayOrder: 'display_order',
};

const AUDIT_FIELD_MAP: Record<string, string> = {
  performedBy: 'performed_by',
  targetId: 'target_id',
  metadata: 'metadata',
  timestamp: 'timestamp',
};

const SETTINGS_FIELD_MAP: Record<string, string> = {
  updatedAt: 'updated_at',
  autoComputedFields: 'auto_computed_fields',
};

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function applyMap(data: Record<string, unknown>, map: Record<string, string>): Record<string, unknown> {
  const cleaned = sbCleanRow(data);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(cleaned)) {
    const mapped = map[key] || toSnakeCase(key); // auto camelCase → snake_case
    out[mapped] = val;
  }
  // createdAt → created_at
  if (out.createdAt !== undefined) {
    out.created_at = out.createdAt;
    delete out.createdAt;
  }
  if (out.updatedAt !== undefined && out.updated_at === undefined) {
    out.updated_at = out.updatedAt;
    delete out.updatedAt;
  }
  return out;
}

// ─── Mapped upsert helpers (call these from firestore.ts) ────────

export function sbMirrorBooking(data: Record<string, unknown>): void {
  sbUpsert('bookings', applyMap(data, BOOKING_FIELD_MAP));
}

export function sbMirrorBookingUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('bookings', id, applyMap(data, BOOKING_FIELD_MAP));
}

export function sbMirrorTicket(data: Record<string, unknown>): void {
  sbUpsert('tickets', applyMap(data, TICKET_FIELD_MAP));
}

export function sbMirrorTicketUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('tickets', id, applyMap(data, TICKET_FIELD_MAP));
}

export function sbMirrorSeat(data: Record<string, unknown>): void {
  sbUpsert('seats', applyMap(data, SEAT_FIELD_MAP));
}

export function sbMirrorSeatMany(rows: Record<string, unknown>[]): void {
  sbUpsertMany('seats', rows.map((r) => applyMap(r, SEAT_FIELD_MAP)));
}

export function sbMirrorSeatUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('seats', id, applyMap(data, SEAT_FIELD_MAP));
}

export function sbMirrorEvent(data: Record<string, unknown>): void {
  sbUpsert('events', applyMap(data, EVENT_FIELD_MAP));
}

export function sbMirrorEventUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('events', id, applyMap(data, EVENT_FIELD_MAP));
}

export function sbMirrorShow(data: Record<string, unknown>): void {
  sbUpsert('shows', applyMap(data, EVENT_FIELD_MAP));
}

export function sbMirrorShowUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('shows', id, applyMap(data, EVENT_FIELD_MAP));
}

export function sbMirrorTicketType(data: Record<string, unknown>): void {
  sbUpsert('ticket_types', applyMap(data, TICKET_TYPE_FIELD_MAP));
}

export function sbMirrorTicketTypeUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('ticket_types', id, applyMap(data, TICKET_TYPE_FIELD_MAP));
}

export function sbMirrorScannerMember(data: Record<string, unknown>): void {
  sbUpsert('scanner_members', applyMap(data, SCANNER_FIELD_MAP));
}

export function sbMirrorScannerMemberUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('scanner_members', id, applyMap(data, SCANNER_FIELD_MAP));
}

export function sbMirrorTicketEntry(data: Record<string, unknown>): void {
  sbUpsert('ticket_entries', applyMap(data, ENTRY_FIELD_MAP));
}

export function sbMirrorGate(data: Record<string, unknown>): void {
  sbUpsert('gates', applyMap(data, GATE_FIELD_MAP));
}

export function sbMirrorGateUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('gates', id, applyMap(data, GATE_FIELD_MAP));
}

export function sbMirrorCounter(data: Record<string, unknown>): void {
  sbUpsert('counters', applyMap(data, {}));
}

export function sbMirrorCounterUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('counters', id, applyMap(data, {}));
}

export function sbMirrorBlockCategories(rows: Record<string, unknown>[]): void {
  sbUpsertMany('block_categories', rows.map((r) => sbCleanRow(r)));
}

export function sbMirrorSettings(docId: string, data: Record<string, unknown>): void {
  const cleaned = applyMap(data, SETTINGS_FIELD_MAP);
  cleaned.id = docId;
  sbUpsert('settings', cleaned);
}

export function sbMirrorAuditLog(data: Record<string, unknown>): void {
  sbUpsert('audit_logs', applyMap(data, AUDIT_FIELD_MAP));
}

export function sbMirrorDelete(table: string, id: string): void {
  sbDelete(table, id);
}

export { sb };
