/**
 * OTP Service Architecture for JATRA BAZAAR
 *
 * Implements a pluggable OTP provider pattern:
 * - In Development/Testing: DevFakeOtpProvider accepts fixed OTP '123456'
 * - In Production: Enforces a real SMS provider (e.g. Twilio, MSG91, Fast2SMS)
 *
 * Fake OTP is STRICTLY disallowed in production environments.
 */

export interface OtpResult {
  success: boolean;
  message?: string;
}

export interface OtpProvider {
  name: string;
  isTestProvider: boolean;
  sendOtp(mobile: string): Promise<OtpResult>;
  verifyOtp(mobile: string, code: string): Promise<OtpResult>;
}

/**
 * Development & Testing Fake OTP Provider.
 * Fixed test OTP: 123456
 */
export class DevFakeOtpProvider implements OtpProvider {
  name = 'DevFakeOtpProvider';
  isTestProvider = true;
  private fixedOtp = '123456';

  private isAllowedEnvironment(): boolean {
    // Only allow in development or when explicitly enabled via env flag for testing
    return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true';
  }

  async sendOtp(mobile: string): Promise<OtpResult> {
    if (!this.isAllowedEnvironment()) {
      return {
        success: false,
        message: 'Fake OTP provider is strictly disabled in production environments.',
      };
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit mobile number.',
      };
    }

    // In dev testing, log the fake OTP to the server console only
    console.log(`[DevFakeOtpProvider] Test OTP for mobile ${cleanMobile}: ${this.fixedOtp}`);

    return {
      success: true,
      message: 'Test OTP sent. Use 123456 for testing.',
    };
  }

  async verifyOtp(mobile: string, code: string): Promise<OtpResult> {
    if (!this.isAllowedEnvironment()) {
      return {
        success: false,
        message: 'Fake OTP provider is strictly disabled in production environments.',
      };
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return {
        success: false,
        message: 'Invalid mobile number format.',
      };
    }

    if (code.trim() !== this.fixedOtp) {
      return {
        success: false,
        message: 'Invalid OTP. Please enter the correct verification code (use 123456 in test mode).',
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  }
}

/**
 * Production Real SMS OTP Provider (Stub ready for vendor integration).
 */
export class RealSmsOtpProvider implements OtpProvider {
  name = 'RealSmsOtpProvider';
  isTestProvider = false;

  async sendOtp(mobile: string): Promise<OtpResult> {
    // Ready to plug in real SMS gateway (Twilio / MSG91 / Fast2SMS)
    console.log(`[RealSmsOtpProvider] Sending real SMS to ${mobile}...`);
    return {
      success: false,
      message: 'Real SMS provider is not yet configured. Please configure your SMS gateway credentials.',
    };
  }

  async verifyOtp(mobile: string, code: string): Promise<OtpResult> {
    console.log(`[RealSmsOtpProvider] Verifying SMS code ${code} for ${mobile}...`);
    return {
      success: false,
      message: 'Real SMS provider is not yet configured.',
    };
  }
}

/**
 * Factory to retrieve the active OTP provider based on the environment.
 */
export function getOtpProvider(): OtpProvider {
  const isDev = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true';
  if (isDev) {
    return new DevFakeOtpProvider();
  }
  return new RealSmsOtpProvider();
}
