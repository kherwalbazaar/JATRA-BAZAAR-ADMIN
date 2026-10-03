/**
 * Project financial rules for the Online History section.
 *
 * Profit is NEVER assumed to be equal to the extra charges collected from the
 * customer. Every value below comes from one configured source of truth:
 *
 *   Profit = (retained share of collected charges) − (actual business costs)
 *
 * Charge collection rules live in `pricing.ts` (PRICING_CONFIG).
 * Retention + cost rules live here (FINANCE_CONFIG).
 *
 * Change a rate here and every summary card, table row, export and receipt
 * in the Online History section updates automatically.
 */

import { BookingItem, PaymentStatus } from '@/types';
import {
  PRICING_CONFIG,
  calculateCustomerCharges,
  roundToPaise,
} from './pricing';

export const FINANCE_CONFIG = {
  /**
   * Share (0 – 1) of each collected charge that is retained as earnings.
   * Set a component to 0 when it is remitted elsewhere (e.g. GST dues).
   */
  RETENTION: {
    convenienceFee: 1,
    gst: 1,
    platformCharge: 1,
    otherCharges: 1,
  },

  /** Actual payment gateway / processing cost, when not stored on the transaction. */
  GATEWAY_FEE_RATE: 0.02,
  GATEWAY_FEE_FIXED: 0,

  /** Any additional business cost expressed as a rate on the amount received. */
  OTHER_COST_RATE: 0,

  CURRENCY_SYMBOL: '₹',
} as const;

export interface TransactionFinance {
  ticketAmount: number;
  gst: number;
  platformCharge: number;
  convenienceFee: number;
  otherCharges: number;
  /** Sum of the charges collected from the customer (excludes gateway fee). */
  totalExtraCharges: number;
  /** Final amount actually paid by the customer. */
  totalPaid: number;
  /** Payment gateway / processing cost — a cost, never an earning. */
  paymentGatewayFee: number;
  otherCost: number;
  /** gateway fee + other configured business costs. */
  actualCost: number;
  /** Retained share of the collected charges before costs. */
  retainedEarnings: number;
  profit: number;
  chargeSource: 'stored' | 'configured';
}

export function resolvePaymentStatus(booking: BookingItem): PaymentStatus {
  if (booking.paymentStatus) return booking.paymentStatus;
  if (booking.status === 'Refunded') return 'Refunded';
  if (booking.status === 'Cancelled' || booking.bookingStatus === 'Cancelled') {
    return 'Cancelled';
  }
  return 'Successful';
}

/**
 * Recovers the ticket amount from a gross customer amount using the configured
 * pricing rules (ticket + convenience fee + GST on convenience fee + platform charge).
 */
function deriveTicketAmountFromPaid(paid: number): number {
  const gross = Math.max(0, Number(paid) || 0);
  if (gross <= 0) return 0;
  const feeRate =
    PRICING_CONFIG.CONVENIENCE_FEE_RATE *
    (1 + PRICING_CONFIG.CONVENIENCE_FEE_GST_RATE);
  const base = (gross - PRICING_CONFIG.PLATFORM_CHARGE) / (1 + feeRate);
  return base > 0 ? roundToPaise(base) : roundToPaise(gross);
}

function hasStoredCharges(booking: BookingItem): boolean {
  return (
    booking.ticketAmount !== undefined ||
    booking.baseAmount !== undefined ||
    booking.convenienceFee !== undefined ||
    booking.gstOnConvenienceFee !== undefined ||
    booking.platformCharge !== undefined ||
    booking.totalFees !== undefined ||
    booking.finalCustomerAmount !== undefined
  );
}

export function computeTransactionFinance(booking: BookingItem): TransactionFinance {
  const paymentStatus = resolvePaymentStatus(booking);
  const isSettled = paymentStatus === 'Successful';

  let ticketAmount = 0;
  let convenienceFee = 0;
  let gst = 0;
  let platformCharge = 0;
  let otherCharges = roundToPaise(booking.otherCharges ?? 0);
  let totalPaid = 0;
  let chargeSource: 'stored' | 'configured' = 'stored';

  if (hasStoredCharges(booking)) {
    const gross = booking.finalCustomerAmount ?? booking.amount ?? 0;
    const fees = booking.totalFees ?? 0;
    ticketAmount =
      booking.ticketAmount ??
      booking.baseAmount ??
      roundToPaise(Math.max(0, gross - fees));
    convenienceFee = roundToPaise(booking.convenienceFee ?? 0);
    gst = roundToPaise(booking.gstOnConvenienceFee ?? 0);
    platformCharge = roundToPaise(booking.platformCharge ?? 0);
    totalPaid =
      booking.finalCustomerAmount !== undefined
        ? roundToPaise(booking.finalCustomerAmount)
        : booking.amount !== undefined
        ? roundToPaise(booking.amount)
        : roundToPaise(ticketAmount + convenienceFee + gst + platformCharge + otherCharges);
  } else {
    chargeSource = 'configured';
    const paid = booking.amount ?? 0;
    ticketAmount = deriveTicketAmountFromPaid(paid);
    const derived = calculateCustomerCharges(ticketAmount);
    convenienceFee = derived.convenienceFee;
    gst = derived.gstOnConvenienceFee;
    platformCharge = derived.platformCharge;
    totalPaid =
      paid > 0 ? roundToPaise(paid) : roundToPaise(derived.finalCustomerAmount + otherCharges);
  }

  const totalExtraCharges = roundToPaise(
    convenienceFee + gst + platformCharge + otherCharges
  );

  // ── Actual business costs ──────────────────────────────────────
  const isCash = booking.paymentMethod === 'Cash';
  let paymentGatewayFee = 0;
  if (isSettled && !isCash) {
    paymentGatewayFee =
      booking.gatewayFee !== undefined
        ? roundToPaise(booking.gatewayFee)
        : roundToPaise(
            totalPaid * FINANCE_CONFIG.GATEWAY_FEE_RATE + FINANCE_CONFIG.GATEWAY_FEE_FIXED
          );
  }
  const otherCost = isSettled
    ? roundToPaise(totalPaid * FINANCE_CONFIG.OTHER_COST_RATE)
    : 0;
  const actualCost =
    booking.actualCost !== undefined && isSettled
      ? roundToPaise(booking.actualCost)
      : roundToPaise(paymentGatewayFee + otherCost);

  // ── Retained earnings → profit ─────────────────────────────────
  const retainedEarnings = roundToPaise(
    convenienceFee * FINANCE_CONFIG.RETENTION.convenienceFee +
      gst * FINANCE_CONFIG.RETENTION.gst +
      platformCharge * FINANCE_CONFIG.RETENTION.platformCharge +
      otherCharges * FINANCE_CONFIG.RETENTION.otherCharges
  );

  const profit =
    booking.profit !== undefined
      ? roundToPaise(booking.profit)
      : isSettled
      ? roundToPaise(retainedEarnings - actualCost)
      : 0;

  return {
    ticketAmount,
    gst,
    platformCharge,
    convenienceFee,
    otherCharges,
    totalExtraCharges,
    totalPaid,
    paymentGatewayFee,
    otherCost,
    actualCost,
    retainedEarnings,
    profit,
    chargeSource,
  };
}
