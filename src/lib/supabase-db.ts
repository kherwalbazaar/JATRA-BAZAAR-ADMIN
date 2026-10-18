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
  console.error(`[supabase-mirror ERROR] ${op} on ${table} failed:`, err);
}

/** Upsert a row (insert or update by id). */
export function sbUpsert(table: string, data: Record<string, unknown>): void {
  if (!data || Object.keys(data).length === 0) return;
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

/** Update a row by id. Falls back to insert if row was missing in Supabase. */
export function sbUpdate(table: string, id: string, data: Record<string, unknown>): void {
  if (!id || Object.keys(data).length === 0) return;
  sb.from(table)
    .update(data)
    .eq('id', id)
    .select('id')
    .then(({ data: rows, error }) => {
      if (error) {
        logFail(table, 'update', error.message);
      } else if (!rows || rows.length === 0) {
        // Row did not exist in Supabase yet — insert with id if title or required fields exist
        if (data.title || table !== 'events') {
          sb.from(table)
            .upsert({ ...data, id })
            .then(({ error: upsertErr }) => {
              if (upsertErr) logFail(table, 'fallback-insert', upsertErr.message);
            });
        }
      }
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
  committeeId: 'committee_id',
  committeeName: 'committee_name',
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
  committeeId: 'committee_id',
  committeeName: 'committee_name',
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
  committeeId: 'committee_id',
  committeeName: 'committee_name',
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
  committeeId: 'committee_id',
  committeeName: 'committee_name',
  committeeLocation: 'committee_location',
  partyName: 'party_name',
  saleMode: 'sale_mode',
  startTime: 'start_time',
  endTime: 'end_time',
  entryTime: 'entry_time',
  eventTime: 'event_time',
  additionalBanners: 'additional_banners',
  musicDirector: 'music_director',
  trailerUrl: 'trailer_url',
  imageUrl: 'image_url',
  showId: 'show_id',
  eventId: 'event_id',
  dayOfMonth: 'day_of_month',
  totalCapacity: 'total_capacity',
  ticketsSold: 'tickets_sold',
  totalRevenue: 'total_revenue',
  // Common legacy / form aliases
  about: 'description',
  location: 'venue',
  name: 'committee_name',
  organizationName: 'organizer',
  banner: 'poster',
  banners: 'additional_banners',
  committee: 'committee_name',
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
  updatedBy: 'updated_by',
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

export function sbMirrorSeatUpdate(
  id: string,
  data: Record<string, unknown>,
  showId?: string
): void {
  const mapped = applyMap(data, SEAT_FIELD_MAP);
  const sk = id.trim().toUpperCase();
  const prefixed = showId ? `${showId}_${sk}` : '';
  const filter = prefixed
    ? `id.eq.${sk},seat_id.eq.${sk},id.eq.${prefixed}`
    : `id.eq.${sk},seat_id.eq.${sk}`;

  sb.from('seats')
    .update(mapped)
    .or(filter)
    .then(({ error }) => {
      if (error) logFail('seats', 'updateSeat', error.message);
    });
}

/** Delete an entire row of seats for an event from Supabase */
export function sbMirrorDeleteSeatRow(
  eventId: string,
  blockId: string,
  rowId: string
): void {
  const b = blockId.trim().toUpperCase();
  const r = rowId.trim().toUpperCase();
  sb.from('seats')
    .delete()
    .eq('event_id', eventId)
    .eq('block_id', b)
    .eq('row_id', r)
    .then(({ error }) => {
      if (error) logFail('seats', `deleteSeatRow (${b}-${r})`, error.message);
    });
}

/** Delete a specific seat by key for an event from Supabase */
export function sbMirrorDeleteSeat(showId: string, seatKey: string): void {
  const sk = seatKey.trim().toUpperCase();
  const prefixed = `${showId}_${sk}`;
  sb.from('seats')
    .delete()
    .or(`id.eq.${sk},seat_id.eq.${sk},id.eq.${prefixed}`)
    .then(({ error }) => {
      if (error) logFail('seats', `deleteSeat (${sk})`, error.message);
    });
}

const VALID_EVENT_COLUMNS = new Set([
  'id',
  'title',
  'subtitle',
  'event_title',
  'committee_id',
  'committee_name',
  'committee_location',
  'party_name',
  'language',
  'audience',
  'sale_mode',
  'date',
  'day',
  'time',
  'entry_time',
  'start_time',
  'end_time',
  'duration',
  'venue',
  'address',
  'city',
  'phone',
  'status',
  'poster',
  'additional_banners',
  'actors',
  'writer',
  'director',
  'music_director',
  'singer',
  'trailer_url',
  'total_capacity',
  'tickets_sold',
  'total_revenue',
  'organizer',
  'description',
  'created_at',
  'updated_at',
  'image_url',
  'show_id',
  'event_id',
  'year',
  'month',
  'day_of_month',
  'event_time',
]);

function cleanEventRow(data: Record<string, unknown>): Record<string, unknown> {
  const mapped = applyMap(data, EVENT_FIELD_MAP);

  // Address & venue fallback
  if (!mapped.venue && mapped.address) mapped.venue = mapped.address;
  if (!mapped.address && mapped.venue) mapped.address = mapped.venue;

  // Format date if year, month, day_of_month are present
  const mNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  if (mapped.year && mapped.month && mapped.day_of_month) {
    const mo = String(mapped.month).toLowerCase().slice(0, 3);
    const mm = mNames[mo];
    const dd = String(mapped.day_of_month).padStart(2, '0');
    if (mm) {
      mapped.date = `${mapped.year}-${mm}-${dd}`;
    }
  }

  // Filter out any columns NOT in VALID_EVENT_COLUMNS
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mapped)) {
    if (VALID_EVENT_COLUMNS.has(k)) {
      safe[k] = v;
    }
  }
  return safe;
}

export function sbMirrorEvent(data: Record<string, unknown>): void {
  sbUpsert('events', cleanEventRow(data));
}

export function sbMirrorEventUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('events', id, cleanEventRow(data));
}

export function sbMirrorShow(data: Record<string, unknown>): void {
  sbUpsert('shows', cleanEventRow(data));
}

export function sbMirrorShowUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('shows', id, cleanEventRow(data));
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

export function sbMirrorTicketEntryUpdate(id: string, data: Record<string, unknown>): void {
  sbUpdate('ticket_entries', id, applyMap(data, ENTRY_FIELD_MAP));
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
  const cleaned = rows.map((r, index) => {
    const raw = sbCleanRow(r);
    return {
      id: raw.id,
      name: raw.name || raw.id,
      enabled: raw.online === true,
      online: raw.online === true,
      counter: raw.counter === true || raw.online === false,
      builtin: raw.builtin !== false,
      display_order: typeof raw.display_order === 'number' ? raw.display_order : (typeof raw.order === 'number' ? raw.order + 1 : index + 1),
      updated_at: new Date().toISOString(),
    };
  });
  sbUpsertMany('block_categories', cleaned);
}

/**
 * Fetch all block categories directly from Supabase (source of truth).
 */
export async function sbFetchBlockCategories(): Promise<any[]> {
  const { data, error } = await sb
    .from('block_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[Supabase] sbFetchBlockCategories error:', error);
    throw new Error(error.message || 'Failed to fetch block categories from Supabase');
  }

  return (data || []).map((r) => ({
    id: r.id,
    name: r.name || r.id,
    enabled: r.online === true,
    online: r.online === true,
    counter: r.counter === true || r.online === false,
    builtin: r.builtin !== false,
    order: (r.display_order ?? 1) - 1,
  }));
}

/**
 * Update a block category's selling channel in Supabase.
 * - mode = 'online'  => online: true,  counter: false, enabled: true
 * - mode = 'counter' => online: false, counter: true,  enabled: false
 */
export async function sbUpdateBlockChannel(
  id: string,
  mode: 'online' | 'counter'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const isOnline = mode === 'online';
    const payload = {
      online: isOnline,
      counter: !isOnline,
      enabled: isOnline,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from('block_categories')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`[Supabase] sbUpdateBlockChannel for ${id} failed:`, error);
      return { success: false, error: error.message };
    }

    // Broadcast instant update across customer web, APK & admin tabs
    try {
      const channel = sb.channel('block_categories_broadcast');
      channel.send({
        type: 'broadcast',
        event: 'channel_update',
        payload: { id, mode, online: isOnline, counter: !isOnline },
      });
    } catch (bcErr) {
      console.warn('[Supabase] Broadcast channel_update notice:', bcErr);
    }

    return { success: true, data };
  } catch (err: any) {
    console.error(`[Supabase] sbUpdateBlockChannel exception for ${id}:`, err);
    return { success: false, error: err?.message || 'Network error updating block channel' };
  }
}

/**
 * Update a block category's display name in Supabase.
 */
export async function sbUpdateBlockName(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await sb
      .from('block_categories')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    try {
      const channel = sb.channel('block_categories_broadcast');
      channel.send({
        type: 'broadcast',
        event: 'name_update',
        payload: { id, name },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update block name' };
  }
}

/**
 * Save all block categories (batch upsert) to Supabase.
 */
export async function sbSaveAllBlockCategories(
  blocks: { id: string; name: string; online: boolean; counter: boolean; builtin?: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = blocks.map((b, index) => ({
      id: b.id,
      name: b.name || b.id,
      enabled: b.online === true,
      online: b.online === true,
      counter: b.counter === true || b.online === false,
      builtin: b.builtin !== false,
      display_order: index + 1,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await sb.from('block_categories').upsert(rows);
    if (error) throw error;

    try {
      const channel = sb.channel('block_categories_broadcast');
      channel.send({
        type: 'broadcast',
        event: 'categories_changed',
        payload: { count: rows.length },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] sbSaveAllBlockCategories error:', err);
    return { success: false, error: err?.message || 'Failed to save block categories' };
  }
}

/**
 * Realtime subscription to Supabase block categories changes.
 */
export function sbSubscribeBlockCategories(onChange: () => void): () => void {
  const channelName = `sb_block_cats_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const channel = sb.channel(channelName);

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'block_categories' },
      () => {
        onChange();
      }
    )
    .on('broadcast', { event: 'channel_update' }, () => {
      onChange();
    })
    .on('broadcast', { event: 'name_update' }, () => {
      onChange();
    })
    .on('broadcast', { event: 'categories_changed' }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    try {
      sb.removeChannel(channel);
    } catch {}
  };
}

export function sbMirrorSettings(docId: string, data: Record<string, unknown>): void {
  if (!docId || !data || Object.keys(data).length === 0) return;
  const cleaned = sbCleanRow(data);

  // The Supabase settings table stores arbitrary documents inside a JSONB `data` column,
  // with top-level metadata columns: id, key, data, description, updated_by, updated_at
  const isWrapped =
    cleaned.data !== undefined &&
    typeof cleaned.data === 'object' &&
    cleaned.data !== null &&
    !Array.isArray(cleaned.data) &&
    Object.keys(cleaned).every((k) =>
      ['id', 'key', 'data', 'description', 'updated_by', 'updatedBy', 'updated_at', 'updatedAt', 'created_at', 'createdAt'].includes(k)
    );

  const payloadData = isWrapped ? (cleaned.data as Record<string, unknown>) : cleaned;

  const description =
    typeof cleaned.description === 'string'
      ? cleaned.description
      : typeof payloadData.description === 'string'
        ? (payloadData.description as string)
        : typeof payloadData.name === 'string'
          ? (payloadData.name as string)
          : null;

  const updatedBy =
    (typeof cleaned.updatedBy === 'string' ? cleaned.updatedBy : undefined) ||
    (typeof cleaned.updated_by === 'string' ? cleaned.updated_by : undefined) ||
    (typeof payloadData.updatedBy === 'string' ? (payloadData.updatedBy as string) : undefined) ||
    (typeof payloadData.updated_by === 'string' ? (payloadData.updated_by as string) : undefined) ||
    null;

  const updatedAt =
    (cleaned.updatedAt ||
      cleaned.updated_at ||
      payloadData.updatedAt ||
      payloadData.updated_at ||
      new Date().toISOString()) as string;

  const row: Record<string, unknown> = {
    id: docId,
    key: docId,
    data: payloadData,
    description,
    updated_by: updatedBy,
    updated_at: updatedAt,
  };

  sbUpsert('settings', row);
}

export function sbMirrorAuditLog(data: Record<string, unknown>): void {
  sbUpsert('audit_logs', applyMap(data, AUDIT_FIELD_MAP));
}

export function sbMirrorDelete(table: string, id: string): void {
  sbDelete(table, id);
}

export { sb, sb as supabase };
