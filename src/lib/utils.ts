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

export function formatEventDateDots(dateStr?: string): string {
  const rawDate = String(dateStr || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("-");
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  return rawDate || "xx.xx.xxxx";
}

export function getEventExpiryInfo(evt?: { date?: string; time?: string; status?: string }) {
  if (!evt) return { isExpired: false, formattedDate: "", message: "" };

  const rawDate = String(evt.date || "").trim();
  const formattedDate = formatEventDateDots(rawDate);
  const rawStatus = String(evt.status || "").toLowerCase();
  let isExpired = rawStatus === "completed" || rawStatus === "past" || rawStatus === "expired" || rawStatus === "ended";

  if (!isExpired && rawDate) {
    let d: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const parts = rawDate.split("-");
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
      if (!isNaN(parsed)) d = new Date(parsed);
    }

    if (d && !isNaN(d.getTime())) {
      const timeStr = String(evt.time || "").trim();
      const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const mins = match[2] ? parseInt(match[2], 10) : 0;
        const meridiem = (match[3] || "").toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        d.setHours(hours, mins, 0, 0);
        if (hours >= 18) {
          d.setDate(d.getDate() + 1);
          d.setHours(6, 0, 0, 0);
        }
        isExpired = d.getTime() < Date.now();
      } else {
        d.setHours(23, 59, 59, 999);
        isExpired = d.getTime() < Date.now();
      }
    }
  }

  return {
    isExpired,
    formattedDate,
    message: isExpired ? `This event is expired on date ${formattedDate}` : "",
  };
}
