/**
 * Canonical Payment Methods & Booking Parameters Module
 * JATRA BAZAAR ADMIN
 */

import { PaymentMethod, PaymentStatus } from '@/types';

export const CANONICAL_PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Card',
  'Net Banking',
  'Wallet',
  'Other',
];

export const CANONICAL_PAYMENT_STATUSES: PaymentStatus[] = [
  'Successful',
  'Pending',
  'Failed',
  'Refunded',
  'Cancelled',
];

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  // UPI
  upi: 'UPI',
  gpay: 'UPI',
  'google pay': 'UPI',
  googlepay: 'UPI',
  phonepe: 'UPI',
  'paytm upi': 'UPI',
  bhim: 'UPI',
  direct: 'UPI',
  'direct booking': 'UPI',
  'direct instant booking': 'UPI',
  instant: 'UPI',
  online: 'UPI',

  // Cash / Counter
  cash: 'Cash',
  counter: 'Cash',
  'pay at counter': 'Cash',
  'pay at entry gate': 'Cash',
  'pay at entry gate / counter': 'Cash',
  'entry gate': 'Cash',

  // Card
  card: 'Card',
  'debit card': 'Card',
  'credit card': 'Card',
  pos: 'Card',
  debit: 'Card',
  credit: 'Card',

  // Net Banking
  netbanking: 'Net Banking',
  'net banking': 'Net Banking',
  net_banking: 'Net Banking',
  'internet banking': 'Net Banking',
  nb: 'Net Banking',

  // Wallet
  wallet: 'Wallet',
  'paytm wallet': 'Wallet',
  paytm: 'Wallet',
  ppi: 'Wallet',

  // Other
  other: 'Other',
  offline: 'Other',
  cheque: 'Other',
};

export function resolveCanonicalPaymentMethod(input: string): PaymentMethod {
  if (!input || typeof input !== 'string' || !input.trim()) {
    throw new Error(
      `Payment method is required. Allowed values are: ${CANONICAL_PAYMENT_METHODS.join(', ')}`
    );
  }

  const trimmed = input.trim();
  if (CANONICAL_PAYMENT_METHODS.includes(trimmed as PaymentMethod)) {
    return trimmed as PaymentMethod;
  }

  const clean = trimmed
    .replace(/^simulated\s+/i, '')
    .replace(/\s*\([^)]*\)$/g, '')
    .toLowerCase()
    .trim();

  const mapped = PAYMENT_METHOD_MAP[clean];
  if (mapped && CANONICAL_PAYMENT_METHODS.includes(mapped)) {
    return mapped;
  }

  throw new Error(
    `Unsupported payment method: "${input}". Allowed canonical values are: ${CANONICAL_PAYMENT_METHODS.join(', ')}`
  );
}
