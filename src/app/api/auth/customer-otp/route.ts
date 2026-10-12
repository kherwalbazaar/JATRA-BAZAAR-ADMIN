import { NextRequest, NextResponse } from 'next/server';
import { getOtpProvider } from '@/lib/auth/otp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile } = body;

    if (!mobile || typeof mobile !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Mobile number is required.' },
        { status: 400 }
      );
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    const otpProvider = getOtpProvider();
    const result = await otpProvider.sendOtp(cleanMobile);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      isTestMode: otpProvider.isTestProvider,
      mobile: cleanMobile,
    });
  } catch (err: unknown) {
    console.error('customer-otp error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Failed to send OTP.' },
      { status: 500 }
    );
  }
}
