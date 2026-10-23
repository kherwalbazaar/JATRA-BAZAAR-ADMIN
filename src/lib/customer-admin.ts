import { createClient } from '@supabase/supabase-js';
import { CustomerRecord } from '@/types/customer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fmiaiuhmmlyciafxgvna.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const sb = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all customer profiles from Supabase and enrich with booking metrics.
 * Never exposes passwords, OTP hashes, or private tokens.
 */
export async function fetchAdminCustomers(): Promise<CustomerRecord[]> {
  try {
    // 1. Fetch profiles from Supabase
    const { data: profiles, error: profileErr } = await sb
      .from('profiles')
      .select('id, mobile, full_name, email, profile_photo, role, status, is_active, last_login_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (profileErr && profileErr.code !== 'PGRST205') {
      console.warn('Error fetching profiles:', profileErr.message);
    }

    // 2. Fetch booking stats to enrich customer activity
    const { data: bookings } = await sb
      .from('bookings')
      .select('customer_phone, customer_name, customer_email, amount, final_customer_amount, created_at');

    const bookingStatsByPhone = new Map<
      string,
      { count: number; spent: number; name?: string; email?: string; firstDate?: string; lastDate?: string }
    >();

    if (Array.isArray(bookings)) {
      bookings.forEach((b) => {
        const phone = String(b.customer_phone || '').replace(/\D/g, '').slice(-10);
        if (!phone || phone.length !== 10) return;

        const amt = Number(b.final_customer_amount || b.amount || 0);
        const existing = bookingStatsByPhone.get(phone) || {
          count: 0,
          spent: 0,
          name: b.customer_name || '',
          email: b.customer_email || '',
          firstDate: b.created_at,
          lastDate: b.created_at,
        };

        existing.count += 1;
        existing.spent += amt;
        if (!existing.name && b.customer_name) existing.name = b.customer_name;
        if (!existing.email && b.customer_email) existing.email = b.customer_email;
        if (b.created_at) {
          if (!existing.firstDate || new Date(b.created_at) < new Date(existing.firstDate)) {
            existing.firstDate = b.created_at;
          }
          if (!existing.lastDate || new Date(b.created_at) > new Date(existing.lastDate)) {
            existing.lastDate = b.created_at;
          }
        }
        bookingStatsByPhone.set(phone, existing);
      });
    }

    const customerMap = new Map<string, CustomerRecord>();

    // Add registered profiles
    if (Array.isArray(profiles)) {
      profiles.forEach((p) => {
        const cleanMobile = String(p.mobile || '').replace(/\D/g, '').slice(-10);
        const stats = bookingStatsByPhone.get(cleanMobile);

        // Resolve real latest visit / login timestamp from Supabase
        const candidates = [
          p.last_login_at,
          stats?.lastDate,
          p.updated_at,
          p.created_at,
        ].filter(Boolean) as string[];

        let realLastVisit = p.last_login_at || stats?.lastDate || p.updated_at || p.created_at;
        if (candidates.length > 1) {
          realLastVisit = candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        }

        customerMap.set(cleanMobile, {
          id: p.id,
          mobile: cleanMobile,
          full_name: p.full_name || stats?.name || 'Verified Customer',
          email: p.email || stats?.email || null,
          profile_photo: p.profile_photo || null,
          role: 'customer',
          status: p.status || (p.is_active === false ? 'blocked' : 'active'),
          is_active: p.is_active !== false,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at,
          last_login_at: realLastVisit,
          total_bookings: stats?.count || 0,
          total_spent: Math.round(stats?.spent || 0),
        });
      });
    }

    // Include customers found in bookings who haven't completed standalone profile yet
    bookingStatsByPhone.forEach((stats, phone) => {
      if (!customerMap.has(phone)) {
        customerMap.set(phone, {
          id: `cust_${phone}`,
          mobile: phone,
          full_name: stats.name || 'Audience Member',
          email: stats.email || null,
          profile_photo: null,
          role: 'customer',
          status: 'active',
          is_active: true,
          created_at: stats.firstDate || new Date().toISOString(),
          last_login_at: stats.lastDate || stats.firstDate,
          total_bookings: stats.count,
          total_spent: Math.round(stats.spent),
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  } catch (err) {
    console.error('fetchAdminCustomers error:', err);
    return [];
  }
}

/**
 * Fetch all bookings for a single customer by mobile number
 */
export async function fetchCustomerBookingHistory(mobile: string) {
  const cleanPhone = String(mobile).replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return [];

  try {
    const { data, error } = await sb
      .from('bookings')
      .select('*')
      .ilike('customer_phone', `%${cleanPhone}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchCustomerBookingHistory error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('fetchCustomerBookingHistory error:', err);
    return [];
  }
}

/**
 * Update a customer's account status (active vs blocked)
 */
export async function updateCustomerAccountStatus(
  customerId: string,
  mobile: string,
  status: 'active' | 'blocked'
): Promise<boolean> {
  const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
  const nowIso = new Date().toISOString();

  try {
    const { error } = await sb
      .from('profiles')
      .upsert({
        id: customerId,
        mobile: cleanMobile,
        status,
        is_active: status === 'active',
        updated_at: nowIso,
      })
      .select();

    if (error) {
      console.warn('updateCustomerAccountStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateCustomerAccountStatus exception:', err);
    return false;
  }
}
