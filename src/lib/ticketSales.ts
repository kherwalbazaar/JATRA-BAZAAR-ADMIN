import { TicketType, BookingItem, Seat } from '@/types';

export interface TierSalesStats {
  soldUnits: number;
  revenue: number;
}

/**
 * Checks if a ticket tier is for standing / general admission.
 */
export function isStandingTier(type: TicketType): boolean {
  if (!type) return false;
  const name = (type.name || '').toLowerCase();
  const blocks = (type.blocks || []).map((b) => b.trim().toUpperCase());
  return name.includes('standing') || blocks.includes('STANDING');
}

/**
 * Returns a score indicating how specifically and accurately a ticket type matches a seat's block and row.
 * Returns -1 if it does not match. Higher score means higher specificity.
 */
function scoreTierForSeat(
  tt: TicketType,
  seatBlock: string,
  seatRow: string
): number {
  if (isStandingTier(tt)) return -1; // Never match physical seats to standing tiers

  const sBlock = (seatBlock || '').trim().toUpperCase();
  const sRow = (seatRow || '').trim().toUpperCase();
  const baseRow = sRow.replace(/^ROW\s*/i, '').replace(/[0-9]/g, '').trim();

  const blocks = (tt.blocks || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
  const rows = (tt.rows || []).map((r) => r.trim().toUpperCase()).filter(Boolean);

  const hasSpecificBlocks = blocks.length > 0 && !blocks.includes('ALL');
  const hasSpecificRows = rows.length > 0 && !rows.includes('ALL');

  // Check block match
  const blockMatches =
    !hasSpecificBlocks ||
    !sBlock ||
    blocks.includes(sBlock);

  if (!blockMatches) return -1;

  // Check row match
  let rowMatches = false;
  if (!hasSpecificRows) {
    rowMatches = true;
  } else {
    rowMatches =
      Boolean(sRow && rows.includes(sRow)) ||
      Boolean(baseRow && rows.includes(baseRow));
  }

  if (!rowMatches) return -1;

  // Specificity scoring:
  // Both specific row and specific block match: 40
  // Specific row matched: 30
  // Specific block matched: 20
  // Generic match (no specific rows or blocks): 10
  if (hasSpecificBlocks && hasSpecificRows) return 40;
  if (hasSpecificRows) return 30;
  if (hasSpecificBlocks) return 20;
  return 10;
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

  let sBlock = '';
  let sRow = '';

  if (seatObj) {
    sBlock = (seatObj.blockId || '').trim().toUpperCase();
    sRow = (seatObj.rowId || '').trim().toUpperCase();
  }

  if (!sBlock || !sRow) {
    const clean = String(seatRef || '').trim();
    const parts = clean.split(/[-_/\s]+/);

    if (parts.length >= 3) {
      if (!sBlock) sBlock = parts[0].toUpperCase();
      if (!sRow) sRow = parts[1].toUpperCase();
    } else if (parts.length === 2) {
      if (/^[A-Za-z]+$/.test(parts[0])) {
        if (!sRow) sRow = parts[0].toUpperCase();
      } else {
        if (!sBlock) sBlock = parts[0].toUpperCase();
      }
    }
  }

  // Find candidate tier with the highest match score
  let bestTier: TicketType | undefined = undefined;
  let bestScore = -1;

  for (const tt of ticketTypes) {
    const score = scoreTierForSeat(tt, sBlock, sRow);
    if (score > bestScore) {
      bestScore = score;
      bestTier = tt;
    }
  }

  return bestTier;
}

/**
 * Returns all physical seats assigned to this ticket type.
 */
export function getTierPhysicalSeats(
  tier: TicketType,
  allTicketTypes: TicketType[],
  seats: Seat[] = []
): Seat[] {
  if (!seats || seats.length === 0) return [];
  if (isStandingTier(tier)) return [];

  return seats.filter((s) => {
    const matched = matchSeatToTier(s.id, allTicketTypes, s);
    return matched?.id === tier.id;
  });
}

/**
 * Calculates the total seat quota for a ticket tier.
 * For standing / general admission: returns tier.totalQuota.
 * For seated tiers: returns the total count of physical seats created in its assigned rows/blocks.
 * If no physical seats exist for this event at all, falls back to tier.totalQuota.
 */
export function getTierQuota(
  tier: TicketType,
  allTicketTypes: TicketType[] = [],
  seats: Seat[] = []
): number {
  if (isStandingTier(tier)) {
    return tier.totalQuota || 0;
  }

  // If the event has physical seats created in the venue
  if (seats && seats.length > 0) {
    const physicalSeats = getTierPhysicalSeats(tier, allTicketTypes, seats);
    return physicalSeats.length;
  }

  // Fallback if no seats have been created in the venue at all yet
  return tier.totalQuota || 0;
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
