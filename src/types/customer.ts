export interface CustomerProfile {
  id: string; // Linked to Supabase auth.users(id)
  mobile: string; // Verified mobile number
  full_name: string; // Customer full name
  email?: string | null; // Optional email
  profile_photo?: string | null; // Optional profile photo URL
  role: 'customer'; // Fixed role: customer
  is_active: boolean; // Active status flag
  created_at?: string;
  updated_at?: string;
}

export type CustomerAuthStep = 
  | 'ENTER_MOBILE' 
  | 'VERIFY_OTP' 
  | 'COMPLETE_PROFILE' 
  | 'VIEW_PROFILE';
