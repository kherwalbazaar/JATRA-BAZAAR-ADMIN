import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getOtpProvider } from '@/lib/auth/otp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json(
        { success: false, message: 'Mobile number and OTP are required.' },
        { status: 400 }
      );
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    // 1. Verify OTP with active provider (Fake OTP in dev/test, real in prod)
    const otpProvider = getOtpProvider();
    const verification = await otpProvider.verifyOtp(cleanMobile, String(otp));

    if (!verification.success) {
      return NextResponse.json(
        { success: false, message: verification.message },
        { status: 400 }
      );
    }

    // 2. Establish valid Supabase Auth session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase configuration is missing in environment.' },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          requiresServiceKey: true,
          message:
            'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. In order to issue genuine Supabase Auth sessions for mobile OTP verification, please add your Supabase service_role key to .env.local.',
        },
        { status: 500 }
      );
    }

    // Initialize Supabase Admin client on the server side
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate secure deterministic email and password for this mobile number
    const internalEmail = `customer_${cleanMobile}@customer.jatrabazaar.internal`;
    const derivedPassword =
      crypto
        .createHmac('sha256', serviceRoleKey)
        .update(cleanMobile)
        .digest('hex')
        .slice(0, 32) + 'Jb2026!';

    let authUser = null;

    // Check if user already exists or create new one in auth.users
    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: derivedPassword,
        email_confirm: true,
        user_metadata: {
          mobile: cleanMobile,
          role: 'customer',
        },
      });

    if (createData?.user) {
      authUser = createData.user;
    } else if (createError) {
      // Find the existing user
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users.find(
        (u) =>
          u.email === internalEmail ||
          u.user_metadata?.mobile === cleanMobile
      );

      if (existing) {
        authUser = existing;
        // Ensure email is confirmed and password matches for signing in
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: derivedPassword,
          email_confirm: true,
          user_metadata: {
            ...existing.user_metadata,
            mobile: cleanMobile,
            role: 'customer',
          },
        });
      } else {
        throw new Error(createError.message);
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Failed to establish user identity in Supabase Auth.' },
        { status: 500 }
      );
    }

    // Sign in using the anon client to acquire a valid Supabase Auth session token pair
    const clientForAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: sessionData, error: sessionError } =
      await clientForAuth.auth.signInWithPassword({
        email: internalEmail,
        password: derivedPassword,
      });

    if (sessionError || !sessionData?.session) {
      console.error('signInWithPassword error:', sessionError);
      return NextResponse.json(
        { success: false, message: 'Failed to create authenticated session token.' },
        { status: 500 }
      );
    }

    // 3. Check for existing customer profile in public.profiles table
    const { data: existingProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileFetchError) {
      console.warn('Could not query profiles table:', profileFetchError.message);
    }

    return NextResponse.json({
      success: true,
      message: existingProfile ? 'Profile found.' : 'New profile required.',
      session: sessionData.session,
      user: {
        id: authUser.id,
        mobile: cleanMobile,
        email: authUser.email,
      },
      profile: existingProfile || null,
      isNewProfile: !existingProfile,
    });
  } catch (err: unknown) {
    console.error('customer-verify error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Verification failed.' },
      { status: 500 }
    );
  }
}
