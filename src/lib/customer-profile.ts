import { createClient } from '@/utils/supabase/client';
import { CustomerProfile } from '@/types/customer';

/**
 * Fetch the authenticated customer's profile from Supabase.
 * Respects RLS: auth.uid() = id.
 */
export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getCustomerProfile error:', error);
    throw new Error(error.message);
  }

  return (data as CustomerProfile) || null;
}

/**
 * Create or save the customer profile in Supabase.
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

  const payload: Partial<CustomerProfile> = {
    id: params.id,
    mobile: params.mobile.trim(),
    full_name: params.full_name.trim(),
    email: params.email?.trim() || null,
    profile_photo: params.profile_photo?.trim() || null,
    role: 'customer', // Locked to customer on database / application level
    is_active: true,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('saveCustomerProfile error:', error);
    throw new Error(error.message);
  }

  return data as CustomerProfile;
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

  const updates: Record<string, unknown> = {
    full_name: params.full_name.trim(),
    email: params.email?.trim() || null,
    profile_photo: params.profile_photo?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('updateCustomerProfile error:', error);
    throw new Error(error.message);
  }

  return data as CustomerProfile;
}
