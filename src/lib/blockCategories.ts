export interface BlockCategory {
  /** Stable block id used across seats / diagram / bookings (e.g. "A1", "Gallery"). */
  id: string;
  /** Editable display name (e.g. "VIP Left"). */
  name: string;
  enabled: boolean;
  online: boolean;
  counter: boolean;
  /** Built-in categories can't be deleted (only renamed / disabled). */
  builtin: boolean;
}

/** The venue has exactly 9 block categories. */
export const DEFAULT_BLOCK_IDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

/** Old default ids that are no longer valid — dropped on load (custom blocks survive). */
const LEGACY_BUILTIN_IDS = ['A', 'B', 'C', 'D', 'D1', 'D2', 'D3', 'Gallery', 'Standing', 'Ground'];

export function isLegacyBuiltin(id: string, builtin: boolean): boolean {
  return builtin && LEGACY_BUILTIN_IDS.includes(id);
}

/** Blocks drawn on the stage diagram preview. */
export const DIAGRAM_BLOCK_IDS = ['C2', 'A2', 'C3', 'C1', 'A1', 'A3', 'B1', 'B2', 'B3'];

const STORAGE_KEY = 'jatra_block_categories_v1';

/**
 * Default channel logic:
 * - Every block starts as COUNTER selling (status ON).
 * - When status is switched OFF, the block becomes active for ONLINE selling.
 */
export function defaultBlockCategories(): BlockCategory[] {
  return DEFAULT_BLOCK_IDS.map((id) => ({
    id,
    name: id,
    enabled: true, // status ON = counter selling
    online: false, // only active when status is OFF
    counter: true, // default selling channel
    builtin: true,
  }));
}

export function loadBlockCategories(): BlockCategory[] {
  if (typeof window === 'undefined') return defaultBlockCategories();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBlockCategories();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultBlockCategories();
    const valid = (parsed as BlockCategory[]).filter(
      (b) => b && typeof b.id === 'string' && b.id && typeof b.name === 'string' && b.name
    );
    if (!valid.length) return defaultBlockCategories();
    return valid
      .filter((b) => !isLegacyBuiltin(b.id, b.builtin !== false))
      .map((b) => {
      const online = b.online !== false && !(b.counter !== false); // online only when counter is off
      const counter = !online;
      return {
        id: b.id,
        name: b.name,
        enabled: counter, // status ON = counter selling, OFF = online selling
        online,
        counter,
        builtin: b.builtin !== false,
      };
    });
  } catch {
    return defaultBlockCategories();
  }
}

export function saveBlockCategories(list: BlockCategory[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}
