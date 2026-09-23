import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount).replace('INR', '₹').trim();
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function generateBookingId(): string {
  const prefix = 'JB26-';
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomDigits}`;
}

export function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'TKT-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
