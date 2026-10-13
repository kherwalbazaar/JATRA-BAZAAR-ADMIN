import { createClient } from '@/utils/supabase/client';
import { CustomerProfile } from '@/types/customer';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CACHE_KEY_PREFIX = 'jatra:customer_profile:';

function getLocalProfile(userId: string): CustomerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + userId) || window.localStorage.getItem('jatra:customer_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalProfile(profile: CustomerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY_PREFIX + profile.id, JSON.stringify(profile));
    window.localStorage.setItem('jatra:customer_profile', JSON.stringify(profile));
  } catch {}
}

/**
 * Fetch the authenticated customer's profile from Supabase with Firestore & local fallback.
 * Respects RLS: auth.uid() = id.
 */
export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const supabase = createClient();

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      saveLocalProfile(data as CustomerProfile);
      return data as CustomerProfile;
    }
  } catch (err) {
    console.warn('getCustomerProfile Supabase attempt failed:', err);
  }

  // 2. Try Firestore fallback
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const p = snap.data() as CustomerProfile;
      saveLocalProfile(p);
      return p;
    }
  } catch (err) {
    console.warn('getCustomerProfile Firestore attempt failed:', err);
  }

  // 3. Fallback to localStorage
  return getLocalProfile(userId);
}

/**
 * Create or save the customer profile in Supabase with Firestore & local backup.
 * Strictly assigns role = 'customer' and id = authenticated user ID.
 */
export async function saveCustomerProfile(params: {
  id: string;
  mobile: string;
  full_name: string;
  email?: string | null;
  profile_photo?: string | null;
}): Promise<CustomerProfile> {
  const supabase = createClient();

  // Validate required fields
  if (!params.id) throw new Error('User ID is missing');
  if (!params.mobile) throw new Error('Verified mobile number is required');
  if (!params.full_name?.trim()) throw new Error('Full Name is required');

  const nowIso = new Date().toISOString();
  const payload: CustomerProfile = {
    id: params.id,
    mobile: params.mobile.trim(),
    full_name: params.full_name.trim(),
    email: params.email?.trim() || null,
    profile_photo: params.profile_photo?.trim() || null,
    role: 'customer',
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // Immediate local cache
  saveLocalProfile(payload);

  // Firestore backup
  try {
    await setDoc(doc(db, 'users', params.id), payload, { merge: true });
  } catch (err) {
    console.warn('Firestore profile sync error:', err);
  }

  // Supabase primary write
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.warn('saveCustomerProfile Supabase notice:', error.message);
      // If table 'profiles' is missing in schema cache, return saved payload gracefully
      if (error.code === 'PGRST205' || error.message.includes('profiles')) {
        return payload;
      }
      throw new Error(error.message);
    }

    if (data) {
      saveLocalProfile(data as CustomerProfile);
      return data as CustomerProfile;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('profiles') || msg.includes('schema cache')) {
      return payload;
    }
    throw err;
  }

  return payload;
}

/**
 * Update permitted profile fields for the authenticated customer.
 * Disallows altering id, mobile, or role.
 */
export async function updateCustomerProfile(
  userId: string,
  params: {
    full_name?: string;
    email?: string | null;
    profile_photo?: string | null;
  }
): Promise<CustomerProfile> {
  const supabase = createClient();

  if (!params.full_name?.trim()) throw new Error('Full Name cannot be empty');

  const updates = {
    full_name: params.full_name.trim(),
    email: params.email?.trim() || null,
    profile_photo: params.profile_photo?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  // Update localStorage
  const current = getLocalProfile(userId);
  if (current) {
    saveLocalProfile({ ...current, ...updates });
  }

  // Update Firestore
  try {
    await setDoc(doc(db, 'users', userId), updates, { merge: true });
  } catch (err) {
    console.warn('Firestore profile update notice:', err);
  }

  // Update Supabase
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('profiles')) {
        return { ...(current || { id: userId, mobile: '', role: 'customer', is_active: true }), ...updates };
      }
      throw new Error(error.message);
    }

    if (data) {
      saveLocalProfile(data as CustomerProfile);
      return data as CustomerProfile;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('profiles') || msg.includes('schema cache')) {
      return { ...(current || { id: userId, mobile: '', role: 'customer', is_active: true }), ...updates };
    }
    throw err;
  }

  return { ...(current || { id: userId, mobile: '', role: 'customer', is_active: true }), ...updates };
}
