import { TicketType, BookingItem, Seat } from '@/types';

export interface TierSalesStats {
  soldUnits: number;
  revenue: number;
}

/**
 * Matches a seat reference (e.g. "C1-A-1", "A1-A-2", "A-1" or doc ID) to its TicketType.
 */
export function matchSeatToTier(
  seatRef: string,
  ticketTypes: TicketType[],
  seatObj?: Seat
): TicketType | undefined {
  if (!ticketTypes || ticketTypes.length === 0) return undefined;

  // 1. If we have the hydrated Seat object:
  if (seatObj) {
    const sBlock = (seatObj.blockId || '').trim().toUpperCase();
    const sRow = (seatObj.rowId || '').trim().toUpperCase();
    const baseRow = sRow.replace(/[0-9]/g, '');

    const found = ticketTypes.find((tt) => {
      const blocks = (tt.blocks || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
      const blocksMatch =
        blocks.length === 0 || blocks.includes('ALL') || (sBlock && blocks.includes(sBlock));
      const rows = (tt.rows || []).map((r) => r.trim().toUpperCase()).filter(Boolean);
      const rowsMatch =
        rows.length === 0 ||
        rows.includes('ALL') ||
        (sRow && rows.includes(sRow)) ||
        (baseRow && rows.includes(baseRow));
      return blocksMatch && rowsMatch;
    });
    if (found) return found;
  }

  // 2. Parse from seatRef string: e.g. "C1-A-1", "Block C1-Row A-Seat 1", "A-1", "A1-2"
  const clean = String(seatRef || '').trim();
  const parts = clean.split(/[-_/\s]+/);

  let parsedBlock = '';
  let parsedRow = '';

  if (parts.length >= 3) {
    // Format: Block-Row-Number, e.g. ["C1", "A", "1"]
    parsedBlock = parts[0].toUpperCase();
    parsedRow = parts[1].toUpperCase();
  } else if (parts.length === 2) {
    // Format: Row-Number (e.g. ["A", "1"]) or Block-Seat
    if (/^[A-Za-z]+$/.test(parts[0])) {
      parsedRow = parts[0].toUpperCase();
    } else {
      parsedBlock = parts[0].toUpperCase();
    }
  }

  const baseParsedRow = parsedRow.replace(/[0-9]/g, '');

  return ticketTypes.find((tt) => {
    const blocks = (tt.blocks || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
    const blocksMatch =
      blocks.length === 0 ||
      blocks.includes('ALL') ||
      !parsedBlock ||
      blocks.includes(parsedBlock);
    const rows = (tt.rows || []).map((r) => r.trim().toUpperCase()).filter(Boolean);
    const rowsMatch =
      rows.length === 0 ||
      rows.includes('ALL') ||
      (parsedRow && rows.includes(parsedRow)) ||
      (baseParsedRow && rows.includes(baseParsedRow));
    return blocksMatch && rowsMatch;
  });
}

/**
 * Matches a booking to its TicketType via ticketTypeId, name, block, or price.
 */
export function matchBookingToTier(
  booking: BookingItem,
  ticketTypes: TicketType[]
): TicketType | undefined {
  if (!ticketTypes || ticketTypes.length === 0) return undefined;

  // 1. Direct ID match
  if (booking.ticketTypeId) {
    const bId = booking.ticketTypeId.trim().toLowerCase();
    const byId = ticketTypes.find(
      (tt) => tt.id === booking.ticketTypeId || (tt.id && tt.id.toLowerCase() === bId)
    );
    if (byId) return byId;
  }

  // 2. Exact or normalized Name match
  if (booking.ticketTypeName) {
    const bName = booking.ticketTypeName.trim().toLowerCase();
    const byName = ticketTypes.find((tt) => tt.name.trim().toLowerCase() === bName);
    if (byName) return byName;

    // Substring / alias match (e.g. "3rd" matches "3rd Class", "VIP" matches "VIP")
    const bySub = ticketTypes.find(
      (tt) =>
        bName.includes(tt.name.toLowerCase()) ||
        tt.name.toLowerCase().includes(bName)
    );
    if (bySub) return bySub;
  }

  // 3. Block matching (e.g. "Standing" block)
  if (booking.block) {
    const bBlock = booking.block.trim().toUpperCase();
    const byBlock = ticketTypes.find((tt) =>
      (tt.blocks || []).some((blk) => blk.trim().toUpperCase() === bBlock)
    );
    if (byBlock) return byBlock;
  }

  // 4. Unit price match
  const unitPrice =
    booking.unitPrice ||
    (booking.quantity > 0 ? Math.round(booking.amount / booking.quantity) : 0);
  if (unitPrice > 0) {
    const byPrice = ticketTypes.find((tt) => tt.price === unitPrice);
    if (byPrice) return byPrice;
  }

  return undefined;
}

/**
 * Computes sold units and total revenue for each ticket category from real booking and seat data.
 */
export function computeTicketTypeSales(
  ticketTypes: TicketType[],
  bookings: BookingItem[],
  seats: Seat[] = [],
  eventId?: string | null
): Map<string, TierSalesStats> {
  const result = new Map<string, TierSalesStats>();
  ticketTypes.forEach((t) => {
    result.set(t.id, { soldUnits: 0, revenue: 0 });
  });

  if (!ticketTypes || ticketTypes.length === 0) return result;

  // Filter to active bookings for this event (ignoring cancelled & refunded)
  const activeBookings = bookings.filter((b) => {
    if (eventId) {
      const matchEvent = b.eventId === eventId || b.showId === eventId;
      if (b.eventId && b.showId && !matchEvent) return false;
      if (b.eventId && !b.showId && b.eventId !== eventId) return false;
      if (!b.eventId && b.showId && b.showId !== eventId) return false;
    }
    const status = String(b.status || '').toLowerCase();
    const bStatus = String(b.bookingStatus || '').toLowerCase();
    if (status === 'cancelled' || status === 'refunded' || bStatus === 'cancelled') {
      return false;
    }
    return true;
  });

  // Fast seat object lookup map
  const seatObjMap = new Map<string, Seat>();
  seats.forEach((s) => {
    if (s.id) seatObjMap.set(s.id, s);
    if (s.blockId && s.rowId && s.seatNumber) {
      seatObjMap.set(`${s.blockId}-${s.rowId}-${s.seatNumber}`.toUpperCase(), s);
      seatObjMap.set(`${s.rowId}-${s.seatNumber}`.toUpperCase(), s);
    }
  });

  // Track counted seats to prevent duplicate counting
  const countedSeatKeys = new Set<string>();

  // Process each active booking
  activeBookings.forEach((b) => {
    const seatList: string[] =
      Array.isArray(b.seats) && b.seats.length > 0
        ? b.seats
        : b.seatNumber
        ? [b.seatNumber]
        : [];

    if (seatList.length > 0) {
      // Process individual booked seats
      seatList.forEach((sRef) => {
        const normalizedKey = String(sRef).trim().toUpperCase();
        countedSeatKeys.add(normalizedKey);

        const matchedTier =
          matchSeatToTier(sRef, ticketTypes, seatObjMap.get(normalizedKey) || seatObjMap.get(sRef)) ||
          matchBookingToTier(b, ticketTypes);

        if (matchedTier) {
          const curr = result.get(matchedTier.id) || { soldUnits: 0, revenue: 0 };
          curr.soldUnits += 1;
          curr.revenue += matchedTier.price;
          result.set(matchedTier.id, curr);
        }
      });
    } else {
      // Non-seated bookings (e.g. Standing tier or general quota)
      const matchedTier = matchBookingToTier(b, ticketTypes);
      const qty = Math.max(1, Number(b.quantity) || 1);
      if (matchedTier) {
        const curr = result.get(matchedTier.id) || { soldUnits: 0, revenue: 0 };
        curr.soldUnits += qty;
        curr.revenue += qty * matchedTier.price;
        result.set(matchedTier.id, curr);
      }
    }
  });

  // Check for any physical seats marked 'booked' or 'sold' not covered by bookings
  seats.forEach((s) => {
    if (s.status === 'booked' || s.status === 'sold') {
      const seatKey1 = (s.id || '').trim().toUpperCase();
      const seatKey2 = `${s.blockId}-${s.rowId}-${s.seatNumber}`.trim().toUpperCase();
      const seatKey3 = `${s.rowId}-${s.seatNumber}`.trim().toUpperCase();

      if (
        (seatKey1 && countedSeatKeys.has(seatKey1)) ||
        (seatKey2 && countedSeatKeys.has(seatKey2)) ||
        (seatKey3 && countedSeatKeys.has(seatKey3))
      ) {
        return; // Already counted from booking
      }

      const matchedTier = matchSeatToTier(s.id, ticketTypes, s);
      if (matchedTier) {
        const curr = result.get(matchedTier.id) || { soldUnits: 0, revenue: 0 };
        curr.soldUnits += 1;
        curr.revenue += matchedTier.price;
        result.set(matchedTier.id, curr);
      }
    }
  });

  return result;
}

/**
 * Returns a new list of TicketTypes with the `sold` property dynamically populated.
 */
export function getAugmentedTicketTypes(
  ticketTypes: TicketType[],
  bookings: BookingItem[],
  seats: Seat[] = [],
  eventId?: string | null
): TicketType[] {
  if (!ticketTypes || ticketTypes.length === 0) return [];
  const salesMap = computeTicketTypeSales(ticketTypes, bookings, seats, eventId);

  return ticketTypes.map((t) => {
    const stats = salesMap.get(t.id);
    const computedSold = stats ? stats.soldUnits : t.sold;
    return {
      ...t,
      sold: computedSold,
    };
  });
}
