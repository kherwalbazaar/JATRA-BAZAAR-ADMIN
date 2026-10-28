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

export function isLikelyLogoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (lower.includes('logo')) return true;
  if (lower.includes('jarpa%20opera.png') || lower.includes('jarpa opera.png')) return true;
  if (lower.includes('ramraj%20gayan%20mahal.png') || lower.includes('ramraj gayan mahal.png')) return true;
  return false;
}

export interface EventImageSource {
  poster?: string;
  banner?: string;
  banners?: string[];
  additionalBanners?: string[];
  bannerUrl?: string;
  mainBanner?: string;
  logo?: string;
  partyName?: string;
  organizer?: string;
}

export function getEventBannerImage(evt?: EventImageSource | null): string {
  if (!evt) return '';

  const candidates: string[] = [
    typeof evt.banner === 'string' ? evt.banner : null,
    Array.isArray(evt.banners) && typeof evt.banners[0] === 'string' ? evt.banners[0] : null,
    Array.isArray(evt.additionalBanners) && typeof evt.additionalBanners[0] === 'string' ? evt.additionalBanners[0] : null,
    typeof evt.bannerUrl === 'string' ? evt.bannerUrl : null,
    typeof evt.mainBanner === 'string' ? evt.mainBanner : null,
    typeof evt.poster === 'string' ? evt.poster : null,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  // Pick first candidate that is not a logo
  const nonLogos = candidates.filter((url) => !isLikelyLogoUrl(url));
  if (nonLogos.length > 0) return nonLogos[0];

  // Known Opera Party banner fallbacks if candidate only had logo
  const partyKey = String(evt.partyName || evt.organizer || '').toUpperCase();
  if (partyKey.includes('JARPA')) {
    return 'https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940';
  }
  if (partyKey.includes('RAMRAJ')) {
    return 'https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg';
  }
  if (partyKey.includes('NAHAH')) {
    return 'https://ik.imagekit.io/kherwalbazaar/Nahah%20Opera.jpeg';
  }

  return candidates[0] || '';
}

export function getEventLogoImage(evt?: EventImageSource | null): string {
  if (!evt) return '';
  if (typeof evt.logo === 'string' && evt.logo.trim()) return evt.logo.trim();
  if (typeof evt.poster === 'string' && isLikelyLogoUrl(evt.poster)) return evt.poster.trim();

  const partyKey = String(evt.partyName || evt.organizer || '').toUpperCase();
  if (partyKey.includes('JARPA')) {
    return 'https://ik.imagekit.io/kherwalbazaar/JARPA%20Opera.png';
  }
  if (partyKey.includes('RAMRAJ')) {
    return 'https://ik.imagekit.io/kherwalbazaar/Ramraj%20Gayan%20Mahal.png?updatedAt=1792327416537';
  }
  if (partyKey.includes('NAHAH')) {
    return 'https://ik.imagekit.io/kherwalbazaar/Nahah%20Opera%20Logo.png';
  }

  return typeof evt.poster === 'string' ? evt.poster : '';
}
