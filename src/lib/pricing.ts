/**
 * Gateway-Independent Customer Charge Calculation System
 *
 * Designed to separate pricing and customer charge calculation from any payment gateway.
 * A payment gateway (e.g. Razorpay, Cashfree, PhonePe, Paytm, Stripe) can be integrated
 * later without altering this customer charge calculation system.
 *
 * Charge structure:
 *   Ticket Amount
 *   + Convenience Fee (2.70% of Ticket Amount)
 *   + GST on Convenience Fee (18% on Convenience Fee only)
 *   + Platform Charge (₹8.00 fixed per booking)
 *   = Final Customer Amount
 */

export const PRICING_CONFIG = {
  // Convenience Fee: 2.70% of total ticket amount
  CONVENIENCE_FEE_PERCENTAGE: 2.7,
  CONVENIENCE_FEE_RATE: 0.027,

  // GST: 18% applied strictly to the convenience fee only
  CONVENIENCE_FEE_GST_PERCENTAGE: 18,
  CONVENIENCE_FEE_GST_RATE: 0.18,

  // Platform Charge: Fixed ₹8 per booking
  PLATFORM_CHARGE: 8.0,

  CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
} as const;

export interface ChargeBreakdown {
  ticketAmount: number;
  convenienceFee: number;
  gstOnConvenienceFee: number;
  platformCharge: number;
  totalConvenienceFeeWithGst: number;
  totalFees: number;
  finalCustomerAmount: number;
  finalAmountInPaise: number;
  rates: {
    convenienceFeePercentage: number;
    gstPercentage: number;
    platformCharge: number;
  };
  formatted: {
    ticketAmount: string;
    convenienceFee: string;
    gstOnConvenienceFee: string;
    platformCharge: string;
    totalFees: string;
    finalCustomerAmount: string;
  };
}

export function roundToPaise(value: number): number {
  const num = Number(value) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  const num = Number(amount) || 0;
  return `₹${num.toFixed(2)}`;
}

/**
 * Calculates customer charges in a gateway-independent way.
 */
export function calculateCustomerCharges(ticketAmount: number): ChargeBreakdown {
  const baseTicket = Math.max(0, roundToPaise(Number(ticketAmount) || 0));

  if (baseTicket === 0) {
    return {
      ticketAmount: 0,
      convenienceFee: 0,
      gstOnConvenienceFee: 0,
      platformCharge: 0,
      totalConvenienceFeeWithGst: 0,
      totalFees: 0,
      finalCustomerAmount: 0,
      finalAmountInPaise: 0,
      rates: {
        convenienceFeePercentage: PRICING_CONFIG.CONVENIENCE_FEE_PERCENTAGE,
        gstPercentage: PRICING_CONFIG.CONVENIENCE_FEE_GST_PERCENTAGE,
        platformCharge: PRICING_CONFIG.PLATFORM_CHARGE,
      },
      formatted: {
        ticketAmount: '₹0.00',
        convenienceFee: '₹0.00',
        gstOnConvenienceFee: '₹0.00',
        platformCharge: '₹0.00',
        totalFees: '₹0.00',
        finalCustomerAmount: '₹0.00',
      },
    };
  }

  // 1. Convenience Fee (2.70% of ticket amount)
  const convenienceFee = roundToPaise(baseTicket * PRICING_CONFIG.CONVENIENCE_FEE_RATE);

  // 2. GST (18% strictly on convenience fee only)
  const gstOnConvenienceFee = roundToPaise(convenienceFee * PRICING_CONFIG.CONVENIENCE_FEE_GST_RATE);

  // 3. Platform Charge: Fixed ₹8
  const platformCharge = PRICING_CONFIG.PLATFORM_CHARGE;

  const totalConvenienceFeeWithGst = roundToPaise(convenienceFee + gstOnConvenienceFee);
  const totalFees = roundToPaise(convenienceFee + gstOnConvenienceFee + platformCharge);

  // 4. Final Customer Amount
  const finalCustomerAmount = roundToPaise(baseTicket + totalFees);
  const finalAmountInPaise = Math.round(finalCustomerAmount * 100);

  return {
    ticketAmount: baseTicket,
    convenienceFee,
    gstOnConvenienceFee,
    platformCharge,
    totalConvenienceFeeWithGst,
    totalFees,
    finalCustomerAmount,
    finalAmountInPaise,
    rates: {
      convenienceFeePercentage: PRICING_CONFIG.CONVENIENCE_FEE_PERCENTAGE,
      gstPercentage: PRICING_CONFIG.CONVENIENCE_FEE_GST_PERCENTAGE,
      platformCharge: PRICING_CONFIG.PLATFORM_CHARGE,
    },
    formatted: {
      ticketAmount: formatCurrency(baseTicket),
      convenienceFee: formatCurrency(convenienceFee),
      gstOnConvenienceFee: formatCurrency(gstOnConvenienceFee),
      platformCharge: formatCurrency(platformCharge),
      totalFees: formatCurrency(totalFees),
      finalCustomerAmount: formatCurrency(finalCustomerAmount),
    },
  };
}
