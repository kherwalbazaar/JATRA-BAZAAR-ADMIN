import { PartyItem, EventItem } from '@/types';

export function isCommitteeName(name: string): boolean {
  if (!name) return true;
  const upper = name.trim().toUpperCase();
  return (
    upper.includes('MANDAWA') ||
    upper.includes('COMMITTEE') ||
    upper.includes('SAMITI') ||
    upper.includes('ANUSTHAN') ||
    upper.includes('PARBON PATA') ||
    upper === 'ADIM LAHAH MANDAWA'
  );
}

const DUMMY_NAMES = new Set([
  'DHARAM GADIA OPERA',
  'KHERWAL BIR DILGAR OPERA',
  'SANTALI RANGAMOHAL',
  'SARNA DILGAR OPERA',
  'ADIM LAHAH MANDAWA',
]);

// Real Opera Parties configured in Jatra Bazaar Events Directory
export const DEFAULT_PARTIES: PartyItem[] = [
  {
    id: 'party-adim-owar-jarpa',
    name: 'ADIM OWAR JARPA OPERA',
    logo: 'https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940',
    genre: 'Santali Cultural Opera',
    location: 'Polasdiha, Baghda, Suliapada',
    director: 'Dasarath Singh',
    writer: 'Kanhu Marndi',
    phone: '0123456789',
    phone2: '9876543210',
    activeShows: 1,
    color: 'from-amber-500 to-rose-600',
    status: 'active',
  },
  {
    id: 'party-ramraj-gayan-mohal',
    name: 'RAMRAJ GAYAN MOHAL',
    logo: 'https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg',
    genre: 'Santali Cultural Opera',
    location: 'Basipitha, Khunta, Mayurbhanj, Odisha - 757035',
    director: 'Dasarath Sing',
    writer: 'Maheswar Soren',
    phone: '+91 6372859599',
    phone2: '+91 9437123456',
    activeShows: 1,
    color: 'from-indigo-500 to-purple-600',
    status: 'active',
  },
];

const STORAGE_KEY = 'jatra_custom_parties';

export function getLocalParties(): PartyItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Scrub out dummy parties and committee names
    const filtered = list.filter(
      (p) =>
        p &&
        p.id !== 'party-adim-lahah-mandawa' &&
        !isCommitteeName(p.name) &&
        !DUMMY_NAMES.has(String(p.name || '').trim().toUpperCase())
    );
    if (filtered.length !== list.length) {
      saveLocalParties(filtered);
    }
    return filtered;
  } catch {
    return [];
  }
}

export function saveLocalParties(list: PartyItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function addOrUpdateParty(party: PartyItem): PartyItem[] {
  if (isCommitteeName(party.name) || DUMMY_NAMES.has(party.name.trim().toUpperCase())) {
    return getLocalParties();
  }
  const current = getLocalParties();
  const index = current.findIndex((p) => p.id === party.id);
  let updated: PartyItem[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...party };
  } else {
    updated = [party, ...current];
  }
  saveLocalParties(updated);
  return updated;
}

export function deleteLocalParty(id: string): PartyItem[] {
  const current = getLocalParties();
  const updated = current.filter((p) => p.id !== id);
  saveLocalParties(updated);
  return updated;
}

/**
 * Computes the unified parties list dynamically from real events in Jatra Bazaar Events Directory.
 */
export function computeParties(events: EventItem[] = []): PartyItem[] {
  if (Array.isArray(events) && events.length > 0) {
    const map = new Map<string, PartyItem>();

    events.forEach((ev) => {
      const rawParty = String(ev.partyName || (ev as unknown as Record<string, unknown>).party_name || '').trim();
      // Never treat committee name or dummy name as party name
      if (!rawParty || isCommitteeName(rawParty) || DUMMY_NAMES.has(rawParty.toUpperCase())) return;
      const key = rawParty.toUpperCase();

      const poster = ev.poster || '';
      const location = ev.venue || ev.address || ev.city || 'Mayurbhanj, Odisha';
      const rawPhone = ev.phone || '';
      const rawPhone2 = (ev as unknown as Record<string, unknown>).phone2 as string || '';
      let p1 = rawPhone;
      let p2 = rawPhone2;
      if (!p2 && (p1.includes(',') || p1.includes('/'))) {
        const parts = p1.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
        p1 = parts[0] || '';
        p2 = parts.slice(1).join(' / ') || '';
      }
      const director = (ev as unknown as Record<string, unknown>).director as string || ev.director || '';
      const writer = (ev as unknown as Record<string, unknown>).writer as string || ev.writer || '';
      const language = (ev as unknown as Record<string, unknown>).language as string || 'Santali';

      if (map.has(key)) {
        const item = map.get(key)!;
        item.activeShows = (item.activeShows || 0) + 1;
        if (!item.logo && poster) item.logo = poster;
        if (!item.phone && p1) item.phone = p1;
        if (!item.phone2 && p2) item.phone2 = p2;
        if (!item.director && director) item.director = director;
        if (!item.writer && writer) item.writer = writer;
      } else {
        map.set(key, {
          id: `party-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: rawParty,
          logo: poster,
          genre: `${language} Cultural Opera`,
          location,
          director,
          writer,
          phone: p1,
          phone2: p2,
          activeShows: 1,
          color: key.includes('RAMRAJ')
            ? 'from-indigo-500 to-purple-600'
            : 'from-amber-500 to-rose-600',
          status: 'active',
        });
      }
    });

    const extracted = Array.from(map.values());
    if (extracted.length > 0) {
      return extracted;
    }
  }

  return DEFAULT_PARTIES;
}
