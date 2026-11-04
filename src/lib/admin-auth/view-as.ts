import 'server-only';
import { cookies } from 'next/headers';

export const VIEW_AS_COOKIE = 'jb_view_as';

/** Lifetime matches a working session in the panel; re-switching is one click. */
const VIEW_AS_TTL_SECONDS = 60 * 60 * 8;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The committee a Super Admin is currently browsing as. Nothing here is
 * trusted on its own: the session builder only consults it after the database
 * has confirmed the caller really is a Super Admin, and re-reads the committee
 * and its grants from the database.
 */
export async function readViewAsCommitteeId(): Promise<string | null> {
  const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value || '';
  const id = String(raw).trim();
  return UUID_RE.test(id) ? id : null;
}

export async function writeViewAsCommitteeId(committeeId: string | null): Promise<void> {
  const cookieStore = await cookies();
  if (!committeeId) {
    cookieStore.delete(VIEW_AS_COOKIE);
    return;
  }
  cookieStore.set(VIEW_AS_COOKIE, committeeId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_AS_TTL_SECONDS,
  });
}
