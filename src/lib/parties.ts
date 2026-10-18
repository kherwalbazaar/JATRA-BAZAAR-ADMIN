import { PartyItem, EventItem } from '@/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from './firebase';
import { sb, sbMirrorSettings } from './supabase-db';

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
    // Asynchronously sync to Firestore settings/parties
    setDoc(
      doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'parties'),
      { parties: list, updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
    // Asynchronously mirror to Supabase settings table
    sbMirrorSettings('parties', {
      id: 'parties',
      key: 'parties',
      data: { parties: list, updatedAt: new Date().toISOString() },
      description: 'Configured Opera Parties Directory',
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function syncRemoteParties(): Promise<PartyItem[]> {
  // 1. Try Supabase settings table first
  try {
    const { data, error } = await sb.from('settings').select('*').eq('id', 'parties');
    if (!error && Array.isArray(data) && data.length > 0) {
      const partiesData = data[0]?.data?.parties || (Array.isArray(data[0]?.data) ? data[0].data : null);
      if (Array.isArray(partiesData) && partiesData.length > 0) {
        const remote = partiesData.filter(
          (p: PartyItem) => p && p.name && !isCommitteeName(p.name) && !DUMMY_NAMES.has(p.name.trim().toUpperCase())
        );
        const local = getLocalParties();
        const mergedMap = new Map<string, PartyItem>();
        remote.forEach((p: PartyItem) => mergedMap.set(p.name.trim().toUpperCase(), p));
        local.forEach((p: PartyItem) => mergedMap.set(p.name.trim().toUpperCase(), { ...(mergedMap.get(p.name.trim().toUpperCase()) || {}), ...p }));
        const merged = Array.from(mergedMap.values());
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('syncRemoteParties Supabase error:', err);
  }

  // 2. Try Firestore fallback
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'parties'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.parties)) {
        const remote = data.parties.filter(
          (p: PartyItem) => p && p.name && !isCommitteeName(p.name) && !DUMMY_NAMES.has(p.name.trim().toUpperCase())
        );
        const local = getLocalParties();
        const mergedMap = new Map<string, PartyItem>();
        remote.forEach((p: PartyItem) => mergedMap.set(p.name.trim().toUpperCase(), p));
        local.forEach((p: PartyItem) => mergedMap.set(p.name.trim().toUpperCase(), { ...(mergedMap.get(p.name.trim().toUpperCase()) || {}), ...p }));
        const merged = Array.from(mergedMap.values());
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('syncRemoteParties Firestore error:', err);
  }
  return getLocalParties();
}

export function addOrUpdateParty(party: PartyItem): PartyItem[] {
  if (isCommitteeName(party.name) || DUMMY_NAMES.has(party.name.trim().toUpperCase())) {
    return getLocalParties();
  }
  const current = getLocalParties();
  const index = current.findIndex(
    (p) => p.id === party.id || p.name.trim().toUpperCase() === party.name.trim().toUpperCase()
  );
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
 * Computes the unified parties list dynamically by combining DEFAULT_PARTIES,
 * custom created/saved parties, and parties extracted from live events.
 */
export function computeParties(events: EventItem[] = []): PartyItem[] {
  const map = new Map<string, PartyItem>();

  // 1. Seed with DEFAULT_PARTIES
  DEFAULT_PARTIES.forEach((p) => {
    const key = p.name.trim().toUpperCase();
    map.set(key, { ...p, activeShows: 0 });
  });

  // 2. Overlay custom added/created parties from local/remote storage
  const localList = getLocalParties();
  localList.forEach((p) => {
    if (!p || !p.name || isCommitteeName(p.name) || DUMMY_NAMES.has(p.name.trim().toUpperCase())) return;
    const key = p.name.trim().toUpperCase();
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        ...p,
        logo: p.logo || existing.logo,
        director: p.director || existing.director,
        writer: p.writer || existing.writer,
        phone: p.phone || existing.phone,
        phone2: p.phone2 || existing.phone2,
        location: p.location || existing.location,
        activeShows: existing.activeShows || 0,
      });
    } else {
      map.set(key, { ...p, activeShows: 0 });
    }
  });

  // 3. Overlay and calculate active shows from real events in database
  if (Array.isArray(events) && events.length > 0) {
    events.forEach((ev) => {
      const rawParty = String(ev.partyName || (ev as unknown as Record<string, unknown>).party_name || '').trim();
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
  }

  return Array.from(map.values());
}

/**
 * Finds party item by name (case-insensitive)
 */
export function getPartyByName(name: string, events: EventItem[] = []): PartyItem | undefined {
  if (!name) return undefined;
  const target = name.trim().toUpperCase();
  const all = computeParties(events);
  return all.find((p) => p.name.trim().toUpperCase() === target);
}
