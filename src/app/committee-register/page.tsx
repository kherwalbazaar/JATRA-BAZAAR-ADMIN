'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, CheckCircle2, ChevronDown, Eye, EyeOff } from 'lucide-react';
import {
  validateCommitteeRegistration,
  PASSWORD_RULE,
  type CommitteeRegistrationInput,
} from '@/lib/committee-registration';

type FormState = Omit<CommitteeRegistrationInput, 'eventDate'>;

const EMPTY: FormState = {
  committeeName: '',
  email: '',
  primaryMobile: '',
  address: '',
  password: '',
  confirmPassword: '',
};

type FieldName = keyof FormState;

const REQUIRED: Partial<Record<FieldName, boolean>> = {
  committeeName: true,
  email: true,
  primaryMobile: true,
  address: true,
  password: true,
  confirmPassword: true,
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CURRENT_YEAR = new Date().getFullYear();
// This year plus the next eleven.
const YEARS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR + i);

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const GRID_ITEM =
  'px-1 py-2.5 text-[11px] font-bold rounded-lg truncate transition-colors';

export default function CommitteeRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [openGrid, setOpenGrid] = useState<'month' | 'year' | null>(null);
  const dateBlock = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [visible, setVisible] = useState<Partial<Record<FieldName, boolean>>>({});

  const set = (key: FieldName, sanitize?: (value: string) => string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = sanitize ? sanitize(event.target.value) : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    if (!openGrid) return;
    const close = (event: Event) => {
      if (!dateBlock.current?.contains(event.target as Node)) setOpenGrid(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [openGrid]);

  // Only a complete triple becomes a date; a partial pick stays a validation error.
  const picked = Boolean(day && month && year);
  const eventDate = picked ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
  const eventDateLabel = picked ? `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}` : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError('');

    const payload: CommitteeRegistrationInput = { ...form, eventDate };
    const clientErrors = validateCommitteeRegistration(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/committee-register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrors(data.fields || {});
        setServerError(data.error || 'Registration failed. Try again.');
        return;
      }

      setDone(data.applicationRef || '');
      setTimeout(() => router.push('/committee-status'), 2600);
    } catch {
      setServerError('Network problem. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">Application submitted</h1>
          <p className="mt-2 text-sm text-slate-600">
            Application ID <span className="font-bold text-emerald-700">{done || '—'}</span>. Your committee is
            now pending Super Admin review.
          </p>
          <p className="mt-2 text-xs text-slate-400">Taking you to the status page…</p>
          <Link
            href="/committee-status"
            className="mt-6 inline-flex h-11 items-center px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            View application status
          </Link>
        </div>
      </main>
    );
  }

  const field = (
    key: FieldName,
    label: string,
    type = 'text',
    extra: {
      autoComplete?: string;
      inputMode?: 'text' | 'numeric' | 'email';
      maxLength?: number;
      placeholder?: string;
      numeric?: boolean;
      secret?: boolean;
    } = {}
  ) => {
    const secret = Boolean(extra.secret);
    const shown = secret && Boolean(visible[key]);

    const input = (
      <input
        id={key}
        type={secret ? (shown ? 'text' : 'password') : type}
        autoComplete={extra.autoComplete}
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        value={form[key] || ''}
        onChange={set(key, extra.numeric ? onlyDigits : undefined)}
        className={`${secret ? 'w-full h-11 pl-3 pr-11' : 'mt-1.5 w-full h-11 px-3'} text-sm border bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 ${
          errors[key] ? 'border-rose-500' : 'border-slate-300 focus:border-indigo-500'
        }`}
      />
    );

    return (
      <div>
        <label htmlFor={key} className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
          {label}
          {REQUIRED[key] ? <span className="text-rose-600"> *</span> : <span className="text-slate-400 font-semibold"> (optional)</span>}
        </label>
        {secret ? (
          <div className="relative mt-1.5">
            {input}
            <button
              type="button"
              onClick={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
              aria-label={shown ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-0 h-11 w-10 flex items-center justify-center text-slate-400 hover:text-indigo-700"
            >
              {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          input
        )}
        {errors[key] && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors[key]}</p>}
      </div>
    );
  };

  const clearDateError = () =>
    setErrors((prev) => {
      if (!prev.eventDate) return prev;
      const next = { ...prev };
      delete next.eventDate;
      return next;
    });

  const gridToggle = (which: 'month' | 'year', text: string, placeholder: string) => (
    <button
      type="button"
      onClick={() => setOpenGrid((current) => (current === which ? null : which))}
      aria-expanded={openGrid === which}
      className={`flex-1 h-11 min-w-0 px-3 flex items-center justify-between gap-1 text-sm border bg-white outline-none transition-colors ${
        errors.eventDate ? 'border-rose-500' : 'border-slate-300 hover:border-indigo-400'
      }`}
    >
      <span className={`truncate ${text ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
        {text || placeholder}
      </span>
      <ChevronDown
        className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${openGrid === which ? 'rotate-180' : ''}`}
      />
    </button>
  );

  const gridPanel = (
    options: { value: string; label: string }[],
    selected: string,
    choose: (value: string) => void
  ) => (
    <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            choose(option.value);
            setOpenGrid(null);
            clearDateError();
          }}
          className={`${GRID_ITEM} ${
            option.value === selected
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0c102a] via-[#1e2756] to-[#0c102a] text-white">
        <div className="absolute -right-16 -top-20 w-52 h-52 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="relative max-w-3xl mx-auto px-5 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ic_launcher.png" alt="Jatra Bazaar" className="w-9 h-9 rounded-md object-cover ring-1 ring-amber-400/30" />
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-wide">JATRA BAZAAR</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-indigo-200 font-bold">
                Committee Registration
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-100 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </div>
      </header>

      <form onSubmit={submit} className="max-w-3xl mx-auto px-5 py-8 space-y-8">
        <section className="bg-white border border-slate-200 p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Committee details</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {field('committeeName', 'Committee name')}
            {field('email', 'Email address', 'email', { autoComplete: 'email', inputMode: 'email' })}
            {field('primaryMobile', 'Primary mobile number', 'tel', {
              autoComplete: 'tel',
              inputMode: 'numeric',
              maxLength: 11,
              numeric: true,
            })}
            {field('address', 'Address', 'text', {
              autoComplete: 'street-address',
              placeholder: 'Village / town, district',
            })}
            <div ref={dateBlock} className="sm:col-span-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Event date<span className="text-rose-600"> *</span>
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={2}
                  placeholder="DD"
                  aria-label="Day of month"
                  value={day}
                  onChange={(e) => {
                    setDay(onlyDigits(e.target.value).slice(0, 2));
                    clearDateError();
                  }}
                  className={`h-11 w-16 shrink-0 px-2 text-sm text-center border bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.eventDate ? 'border-rose-500' : 'border-slate-300 focus:border-indigo-500'
                  }`}
                />
                {gridToggle('month', month ? MONTHS[Number(month) - 1] : '', 'Month')}
                {gridToggle('year', year, 'Year')}
              </div>
              {openGrid === 'month' &&
                gridPanel(
                  MONTHS.map((name, index) => ({ value: String(index + 1), label: name })),
                  month,
                  (value) => {
                    setMonth(value);
                    clearDateError();
                  }
                )}
              {openGrid === 'year' &&
                gridPanel(
                  YEARS.map((value) => ({ value: String(value), label: String(value) })),
                  year,
                  (value) => {
                    setYear(value);
                    clearDateError();
                  }
                )}
              {eventDateLabel && (
                <p className="mt-2 text-[12px] font-bold text-indigo-700">{eventDateLabel}</p>
              )}
              {errors.eventDate && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.eventDate}</p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Login credentials</h2>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{PASSWORD_RULE}</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {field('password', 'Password', 'password', { autoComplete: 'new-password', secret: true })}
            {field('confirmPassword', 'Confirm password', 'password', { autoComplete: 'new-password', secret: true })}
          </div>
        </section>

        {serverError && (
          <p role="alert" className="text-[13px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2.5">
            {serverError}
          </p>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Submitting creates a pending application with no dashboard access. A Super Admin reviews it and
          decides which features your committee can open.
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full sm:w-auto h-11 inline-flex items-center justify-center gap-2 px-7 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold tracking-wide transition-colors"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </main>
  );
}
