'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, ShieldCheck, Building2, KeyRound } from 'lucide-react';
import { useAdminSession } from '@/context/AdminSessionContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loading, session, refresh } = useAdminSession();
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Only same-site paths, so ?next=//evil.com cannot bounce anyone off-site.
  const afterLoginTarget = () => {
    const next = new URLSearchParams(window.location.search).get('next') || '';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/';
  };

  // Anyone already signed in goes straight to their own destination. The session
  // comes from the shared provider so this page and the dashboard never disagree.
  useEffect(() => {
    if (loading || !session) return;
    router.replace(session.canEnterDashboard ? afterLoginTarget() : '/committee-status');
  }, [loading, session, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mobile, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(data.error || 'Sign in failed. Try again.');
        return;
      }
      // The provider still holds the pre-login (signed-out) session; a client-side
      // navigation would reuse it and bounce straight back here.
      const next = await refresh();
      router.replace(next?.canEnterDashboard ? afterLoginTarget() : '/committee-status');
    } catch {
      setError('Network problem. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-white grid lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c102a] via-[#1e2756] to-[#0c102a] text-white px-12 py-14">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="flex items-center gap-3 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ic_launcher.png" alt="Jatra Bazaar" className="w-11 h-11 rounded-md object-cover ring-1 ring-amber-400/30" />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-wide">JATRA BAZAAR</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200 font-bold">Admin Panel</p>
          </div>
        </div>

        <div className="max-w-md relative">
          <h1 className="text-4xl font-black leading-tight">
            One panel.
            <br />
            Two kinds of access.
          </h1>
          <p className="mt-4 text-indigo-100/90 text-sm leading-relaxed">
            Super Admin runs the festival. Committees sign in to only the features the Super Admin has
            granted them — nothing else is reachable, on screen or over the API.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-indigo-50">
            <li className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-amber-400" />
              <span>Role and permissions verified on the server for every request.</span>
            </li>
            <li className="flex items-start gap-3">
              <Building2 className="w-4 h-4 mt-0.5 text-amber-400" />
              <span>Committee applications stay pending until manually approved.</span>
            </li>
            <li className="flex items-start gap-3">
              <KeyRound className="w-4 h-4 mt-0.5 text-amber-400" />
              <span>Passwords are stored only as Supabase Auth hashes.</span>
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-indigo-200/70 font-semibold tracking-wide relative">
          © {new Date().getFullYear()} Jatra Bazaar
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ic_launcher.png" alt="Jatra Bazaar" className="w-10 h-10 rounded-md object-cover ring-1 ring-amber-400/40" />
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-wide text-slate-900">JATRA BAZAAR</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-bold">Admin Panel</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Super Admin and approved committees use this same form.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full h-11 px-3 text-sm border border-slate-300 bg-white text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="mobile" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Mobile number
                <span className="ml-1 text-slate-400 font-semibold normal-case tracking-normal">(Super Admin only)</span>
              </label>
              <input
                id="mobile"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={11}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="10-digit mobile number"
                className="mt-1.5 w-full h-11 px-3 text-sm border border-slate-300 bg-white text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-3 pr-11 text-sm border border-slate-300 bg-white text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-0 h-11 w-10 flex items-center justify-center text-slate-400 hover:text-indigo-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[13px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold tracking-wide transition-colors"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-200 pt-5">
            <p className="text-[13px] text-slate-600">
              Organising a programme for this festival?{' '}
              <Link href="/committee-register" className="font-bold text-indigo-700 hover:text-indigo-800 underline underline-offset-2">
                Register Your Committee
              </Link>
            </p>
            <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              Registered committees can check their application status any time at{' '}
              <Link href="/committee-status" className="font-semibold text-slate-500 underline underline-offset-2">
                Application Status
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
