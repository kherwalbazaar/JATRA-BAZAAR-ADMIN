'use client';

import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  ShieldCheck, 
  User, 
  Mail, 
  Camera, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LogOut, 
  Edit3, 
  Sparkles,
  Lock
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { CustomerProfile, CustomerAuthStep } from '@/types/customer';
import { saveCustomerProfile, updateCustomerProfile, getCustomerProfile } from '@/lib/customer-profile';

export default function CustomerProfileFlow() {
  const [step, setStep] = useState<CustomerAuthStep>('ENTER_MOBILE');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [requiresServiceKey, setRequiresServiceKey] = useState(false);

  const supabase = createClient();

  // 1. Check existing authenticated session on mount (data persistence across page refreshes)
  useEffect(() => {
    async function checkSession() {
      try {
        setInitialLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setAuthUserId(user.id);
          const userMobile = user.user_metadata?.mobile || '';
          if (userMobile) setMobile(userMobile);

          // Fetch profile from Supabase
          try {
            const existingProfile = await getCustomerProfile(user.id);
            if (existingProfile) {
              setProfile(existingProfile);
              setFullName(existingProfile.full_name || '');
              setEmail(existingProfile.email || '');
              setProfilePhoto(existingProfile.profile_photo || '');
              setStep('VIEW_PROFILE');
            } else {
              setStep('COMPLETE_PROFILE');
            }
          } catch {
            setStep('COMPLETE_PROFILE');
          }
        }
      } catch (err) {
        console.warn('Session check error:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    checkSession();
  }, [supabase]);

  // 2. Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setRequiresServiceKey(false);

    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/customer-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: clean }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }

      setMobile(clean);
      setSuccessMsg(data.message);
      setStep('VERIFY_OTP');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP & establish Supabase Auth session
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setRequiresServiceKey(false);

    if (otp.trim().length < 4) {
      setError('Please enter a valid OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/customer-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: otp.trim() }),
      });

      const data = await res.json();

      if (data.requiresServiceKey) {
        setRequiresServiceKey(true);
        throw new Error(data.message);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'OTP verification failed.');
      }

      // Establish Supabase Auth session on the client
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw new Error('Failed to set client auth session: ' + sessionError.message);
        }
      }

      setAuthUserId(data.user.id);

      // Check if existing profile returned
      if (data.profile) {
        setProfile(data.profile);
        setFullName(data.profile.full_name || '');
        setEmail(data.profile.email || '');
        setProfilePhoto(data.profile.profile_photo || '');
        setSuccessMsg('Welcome back! Your existing profile was loaded.');
        setStep('VIEW_PROFILE');
      } else {
        setSuccessMsg('Mobile verified! Please complete your profile.');
        setStep('COMPLETE_PROFILE');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. Save new profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!authUserId) {
      setError('Missing authenticated session. Please verify your mobile number again.');
      setStep('ENTER_MOBILE');
      return;
    }

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    setLoading(true);
    try {
      const saved = await saveCustomerProfile({
        id: authUserId,
        mobile,
        full_name: fullName.trim(),
        email: email.trim() || null,
        profile_photo: profilePhoto.trim() || null,
      });

      setProfile(saved);
      setSuccessMsg('Profile created successfully!');
      setStep('VIEW_PROFILE');
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // 5. Update existing profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!authUserId) return;
    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateCustomerProfile(authUserId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        profile_photo: profilePhoto.trim() || null,
      });

      setProfile(updated);
      setSuccessMsg('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // 6. Sign Out to allow testing with separate test accounts
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setAuthUserId(null);
      setProfile(null);
      setMobile('');
      setOtp('');
      setFullName('');
      setEmail('');
      setProfilePhoto('');
      setIsEditing(false);
      setError(null);
      setSuccessMsg('Signed out. You can now test with another phone number.');
      setStep('ENTER_MOBILE');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[360px] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-3" />
        <p className="text-xs font-semibold">Checking Supabase session...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-slate-800 transition-all">
      {/* Top Banner / Brand Header */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-900 p-6 text-white text-center relative">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center mb-3 shadow-inner border border-white/20">
          <Sparkles className="w-6 h-6 text-amber-300" />
        </div>
        <h2 className="text-lg font-black tracking-wide">JATRA BAZAAR</h2>
        <p className="text-xs text-indigo-200 font-medium mt-0.5">Customer Profile Portal</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Alerts & Messages */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {requiresServiceKey && (
                <div className="mt-2 text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-rose-200 font-mono">
                  <p className="font-bold text-slate-900 mb-1">How to fix:</p>
                  <p>1. Open your Supabase Dashboard &rarr; Project Settings &rarr; API</p>
                  <p>2. Copy the <strong>service_role (secret)</strong> key</p>
                  <p>3. Add to <code className="text-purple-700">.env.local</code>:</p>
                  <p className="font-bold text-slate-900">SUPABASE_SERVICE_ROLE_KEY=your_key_here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {successMsg && !error && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: ENTER MOBILE NUMBER */}
        {step === 'ENTER_MOBILE' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="cust-mobile" className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  +91
                </span>
                <input
                  id="cust-mobile"
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold text-slate-900 tracking-wider focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                For dev testing, any 10-digit number will accept test OTP <strong className="text-purple-700">123456</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length !== 10}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === 'VERIFY_OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Sent to: +91 {mobile}</span>
              <button
                type="button"
                onClick={() => {
                  setStep('ENTER_MOBILE');
                  setOtp('');
                  setError(null);
                }}
                className="text-purple-700 font-bold hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label htmlFor="cust-otp" className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                Verification Code
              </label>
              <div className="relative">
                <input
                  id="cust-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg font-black tracking-widest text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-mono"
                  autoFocus
                />
              </div>

              {/* Dev Test OTP Hint Box */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-purple-900">
                  Fixed Dev OTP: <strong className="font-mono text-purple-700">123456</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setOtp('123456')}
                  className="text-[10px] font-black uppercase text-purple-700 bg-white border border-purple-300 px-2 py-0.5 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Continue</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: COMPLETE PROFILE FORM */}
        {step === 'COMPLETE_PROFILE' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="text-center pb-1">
              <h3 className="text-sm font-black text-slate-900">Create Your Profile</h3>
              <p className="text-[11px] text-slate-400 font-semibold">Please complete your audience details</p>
            </div>

            {/* Verified Mobile (Read-only) */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                Verified Mobile
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value={`+91 ${mobile}`}
                  className="w-full bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-bold rounded-2xl pl-10 pr-24 py-2.5 text-xs select-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-white border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              </div>
            </div>

            {/* Full Name (Required) */}
            <div>
              <label htmlFor="cust-name" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="cust-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <label htmlFor="cust-email" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Profile Photo URL (Optional) */}
            <div>
              <label htmlFor="cust-photo" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                Profile Photo URL <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Camera className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="cust-photo"
                  type="url"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim()}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving profile...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 4: VIEW PROFILE & EDIT MODE */}
        {step === 'VIEW_PROFILE' && (
          <div className="space-y-4">
            {!isEditing ? (
              /* Profile Card Display */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-purple-200/80 bg-purple-50/40 flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profile?.profile_photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={profile.profile_photo}
                        alt={profile.full_name}
                        className="w-full h-full object-cover rounded-[14px]"
                      />
                    ) : (
                      <span className="text-white font-black text-xl">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 truncate">
                        {profile?.full_name || 'Audience Member'}
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                        {profile?.role || 'Customer'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">
                      +91 {profile?.mobile || mobile}
                    </p>
                    {profile?.email && (
                      <p className="text-[11px] text-slate-400 font-medium truncate">
                        {profile.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Identity Metadata Card */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] space-y-1.5 font-medium text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Supabase Auth UID:</span>
                    <span className="font-mono text-slate-800 text-[10px]">{profile?.id?.slice(0, 18)}...</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Account Status:</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Role Permissions:</span>
                    <span className="font-bold text-purple-700">Customer (Enforced)</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs py-3 rounded-2xl border border-purple-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-3 rounded-2xl border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    title="Sign Out to test another customer account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Inline Edit Mode */
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="text-center pb-1">
                  <h3 className="text-sm font-black text-slate-900">Update Profile Details</h3>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Mobile Number (Locked)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`+91 ${profile?.mobile || mobile}`}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-2xl px-3.5 py-2.5 text-xs select-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-name" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="edit-email" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="edit-photo" className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Profile Photo URL
                  </label>
                  <input
                    id="edit-photo"
                    type="url"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFullName(profile?.full_name || '');
                      setEmail(profile?.email || '');
                      setProfilePhoto(profile?.profile_photo || '');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !fullName.trim()}
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Save Changes</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Secure Auth Footer */}
      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold">
        <Lock className="w-3 h-3 text-slate-400" />
        <span>Supabase Row Level Security & Auth Protected</span>
      </div>
    </div>
  );
}
