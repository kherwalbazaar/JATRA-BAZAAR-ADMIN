export interface CustomerProfile {
  id: string; // Linked to Supabase auth.users(id) or cust_${mobile}
  mobile: string; // Verified mobile number
  full_name: string; // Customer full name
  email?: string | null; // Optional email
  profile_photo?: string | null; // Optional profile photo URL
  role: 'customer'; // Fixed role: customer
  status?: 'active' | 'blocked' | 'suspended';
  is_active: boolean; // Active status flag
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerRecord extends CustomerProfile {
  total_bookings?: number;
  total_spent?: number;
}

export type CustomerAuthStep = 
  | 'ENTER_MOBILE' 
  | 'VERIFY_OTP' 
  | 'COMPLETE_PROFILE' 
  | 'VIEW_PROFILE';
