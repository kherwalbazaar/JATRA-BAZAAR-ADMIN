'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Phone, MessageCircle, Mail, LogOut, ArrowRight, Clock, XCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Contact {
  contactName: string;
  primaryMobile: string;
  whatsappNumber: string;
  supportEmail: string;
  supportMessage: string;
}

interface SessionPayload {
  signedIn: boolean;
  canEnterDashboard?: boolean;
  user?: { name: string; email: string };
  committee?: {
    applicationRef: string;
    committeeName: string;
    status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED';
    rejectionReason: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    lastLoginAt: string | null;
  };
  permissions?: Record<string, string[]>;
}

const COPY: Record<string, { title: string; tone: string; message: string; Icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: {
    title: 'Pending approval',
    tone: 'text-amber-900 bg-amber-50 border-amber-200',
    message:
      'Your committee registration has been submitted successfully. Your application is currently under review by the Super Admin. Once approved, you will be able to access your assigned dashboard features.',
    Icon: Clock,
  },
  REJECTED: {
    title: 'Application rejected',
    tone: 'text-rose-800 bg-rose-50 border-rose-200',
    message:
      'The Super Admin reviewed your application and did not approve it. You can contact the administration below to ask what needs correcting and submit again.',
    Icon: XCircle,
  },
  DEACTIVATED: {
    title: 'Account deactivated',
    tone: 'text-slate-800 bg-slate-100 border-slate-300',
    message:
      'This committee account has been deactivated by the Super Admin. Dashboard and protected API access are switched off until it is reactivated.',
    Icon: ShieldAlert,
  },
  APPROVED: {
    title: 'Approved',
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    message: 'Your committee is approved. Open the dashboard to use the features assigned to you.',
    Icon: CheckCircle2,
  },
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CommitteeStatusPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [sessionRes, contactRes] = await Promise.all([
        fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/admin-contact', { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      setSession(await sessionRes.json());
      const contactBody = await contactRes.json().catch(() => ({}));
      if (contactBody?.success) setContact(contactBody.contact);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    router.replace('/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-white">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </main>
    );
  }

  if (!session?.signedIn) {
    return (
      <Shell>
        <h1 className="text-xl font-black text-slate-900">Sign in to check your application</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the email address and password you registered with.
        </p>
        <Link href="/login" className="mt-6 inline-flex h-11 items-center px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
          Go to sign in
        </Link>
      </Shell>
    );
  }

  const committee = session.committee;
  if (!committee) {
    return (
      <Shell>
        <h1 className="text-xl font-black text-slate-900">No committee application on this account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {session.user?.email}. Register a committee or sign in with the account that applied.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/committee-register" className="inline-flex h-11 items-center px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
            Register your committee
          </Link>
          <button onClick={signOut} className="inline-flex h-11 items-center gap-2 px-5 border border-slate-300 text-sm font-bold text-slate-700">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </Shell>
    );
  }

  const copy = COPY[committee.status] || COPY.PENDING;
  const { Icon } = copy;
  const approved = committee.status === 'APPROVED';
  const modules = Object.keys(session.permissions || {});

  return (
    <Shell>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 border text-[12px] font-black uppercase tracking-wider ${copy.tone}`}>
        <Icon className="w-4 h-4" />
        {copy.title}
      </div>
      <h1 className="mt-4 text-2xl font-black text-slate-900">{committee.committeeName}</h1>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{copy.message}</p>

      {committee.status === 'REJECTED' && committee.rejectionReason && (
        <div className="mt-5 border-l-4 border-rose-600 bg-rose-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-800">Reason given</p>
          <p className="mt-1 text-sm text-rose-900">{committee.rejectionReason}</p>
        </div>
      )}

      <dl className="mt-7 grid sm:grid-cols-2 gap-px bg-slate-200 border border-slate-200 text-sm">
        {[
          ['Application ID', committee.applicationRef],
          ['Registered on', formatDate(committee.submittedAt)],
          ['Reviewed on', formatDate(committee.reviewedAt)],
          ['Last sign-in', formatDate(committee.lastLoginAt)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {approved && (
        <div className="mt-6 border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900">Assigned features</p>
          <p className="mt-1.5 text-sm text-emerald-900">{modules.length ? modules.join(' · ') : 'None yet — contact the Super Admin.'}</p>
          {session.canEnterDashboard && (
            <Link
              href="/"
              className="mt-4 inline-flex h-11 items-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
            >
              Enter dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Contact the Super Admin</h2>
        {contact?.contactName || contact?.supportEmail ? (
          <>
            <p className="mt-2 text-sm text-slate-700 font-semibold">{contact.contactName}</p>
            {contact.supportMessage && <p className="mt-1 text-[12px] text-slate-500">{contact.supportMessage}</p>}
            <div className="mt-4 flex flex-wrap gap-2.5">
              {contact.primaryMobile && (
                <a
                  href={`tel:${contact.primaryMobile}`}
                  className="inline-flex h-10 items-center gap-2 px-4 border border-indigo-200 text-indigo-700 text-[13px] font-bold hover:bg-indigo-50 transition-colors"
                >
                  <Phone className="w-4 h-4" /> Call admin
                </a>
              )}
              {contact.whatsappNumber && (
                <a
                  href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 px-4 bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp admin
                </a>
              )}
              {contact.supportEmail && (
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="inline-flex h-10 items-center gap-2 px-4 border border-amber-300 text-amber-800 text-[13px] font-bold hover:bg-amber-50 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Email admin
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-slate-500">
            No contact details have been published yet. Ask your festival administrator directly.
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex h-11 items-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
        >
          {refreshing && <Loader2 className="w-4 h-4 animate-spin" />}
          {refreshing ? 'Checking…' : 'Refresh application status'}
        </button>
        <button onClick={signOut} className="inline-flex h-11 items-center gap-2 px-5 border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <LogOut className="w-4 h-4" /> Return to login
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0c102a] via-[#1e2756] to-[#0c102a] text-white">
        <div className="absolute -right-16 -top-20 w-52 h-52 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="relative max-w-2xl mx-auto px-5 py-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ic_launcher.png" alt="Jatra Bazaar" className="w-9 h-9 rounded-md object-cover ring-1 ring-amber-400/30" />
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-wide">JATRA BAZAAR</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-indigo-200 font-bold">
              Committee Application Status
            </p>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-5 py-8">{children}</div>
    </main>
  );
}
