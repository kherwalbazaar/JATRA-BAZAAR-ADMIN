/**
 * The admin panel has no login system yet, so party-booking write endpoints
 * require a shared secret header. This is a soft gate, not real
 * authentication — the hard boundary is RLS: browser (anon) keys can only
 * read confirmed rows. Defaults keep local dev working; set
 * PARTY_BOOKING_ADMIN_KEY server-side for any deployed instance and keep the
 * frontend header value in sync.
 */
export const PARTY_BOOKING_ADMIN_HEADER = 'x-jatra-admin-key';
export const DEFAULT_ADMIN_KEY = 'jatra-party-booking-admin';
export const PARTY_BOOKING_ADMIN_HEADER_VALUE = DEFAULT_ADMIN_KEY;

export function isAuthorizedAdminRequest(request: Request): boolean {
  const expected = process.env.PARTY_BOOKING_ADMIN_KEY || DEFAULT_ADMIN_KEY;
  return request.headers.get(PARTY_BOOKING_ADMIN_HEADER) === expected;
}
