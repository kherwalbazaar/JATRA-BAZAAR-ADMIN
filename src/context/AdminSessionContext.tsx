'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NavigationTab } from '@/types';
import type { CommitteeStatus } from '@/lib/admin-modules';

export interface PanelUser {
  id: string;
  email: string;
  name: string;
}

export interface CommitteeOption {
  id: string;
  name: string;
  applicationRef: string;
}

export interface CommitteeSummary {
  id: string;
  applicationRef: string;
  committeeName: string;
  status: CommitteeStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  lastLoginAt: string | null;
}

export interface PanelSession {
  signedIn: boolean;
  canEnterDashboard: boolean;
  role: 'super_admin' | 'committee';
  user: PanelUser;
  /** Super Admin powers; false while browsing as a committee. */
  fullAccess: boolean;
  viewingAs: CommitteeSummary | null;
  permissions: Record<string, string[]>;
  allowedTabs: NavigationTab[];
  committee: CommitteeSummary | null;
}

interface SessionContextValue {
  loading: boolean;
  session: PanelSession | null;
  isSuperAdmin: boolean;
  refresh: () => Promise<PanelSession | null>;
  setViewAs: (committeeId: string | null) => Promise<{ ok: boolean; error: string }>;
  signOut: () => Promise<void>;
  /** Approved committees a Super Admin may enter; null until loaded. */
  committeeOptions: CommitteeOption[] | null;
  loadCommittees: () => Promise<CommitteeOption[]>;
  /** Bumped to ask the header switcher to open its list from elsewhere. */
  committeeMenuSignal: number;
  openCommitteeMenu: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PanelSession | null>(null);
  const [committeeOptions, setCommitteeOptions] = useState<CommitteeOption[] | null>(null);
  const [committeeMenuSignal, setCommitteeMenuSignal] = useState(0);
  const pathname = usePathname();

  const fetchSession = useCallback(async (): Promise<PanelSession | null> => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      const next = (data?.signedIn ? (data as PanelSession) : null) || null;
      setSession(next);
      return next;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      return await fetchSession();
    } finally {
      setLoading(false);
    }
  }, [fetchSession]);

  const setViewAs = useCallback(
    async (committeeId: string | null) => {
      try {
        const res = await fetch('/api/admin/view-as', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ committeeId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          return { ok: false, error: data?.error || 'Could not change the committee view.' };
        }
        await refresh();
        return { ok: true, error: '' };
      } catch {
        return { ok: false, error: 'Network problem. Try again.' };
      }
    },
    [refresh]
  );

  const loadCommittees = useCallback(async (): Promise<CommitteeOption[]> => {
    try {
      const res = await fetch('/api/admin/view-as', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: CommitteeOption[] = data?.success ? data.committees || [] : [];
      setCommitteeOptions(list);
      return list;
    } catch {
      setCommitteeOptions([]);
      return [];
    }
  }, []);

  const openCommitteeMenu = useCallback(() => setCommitteeMenuSignal((count) => count + 1), []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setSession(null);
    window.location.href = '/login';
  }, []);

  // Sign-in and sign-out navigate on the client, so this provider is never
  // remounted. Re-reading on every route change keeps login pages and the
  // dashboard from acting on a session that no longer exists.
  useEffect(() => {
    setLoading(true);
    fetchSession().finally(() => setLoading(false));
  }, [pathname, fetchSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      isSuperAdmin: session?.role === 'super_admin',
      refresh,
      setViewAs,
      signOut,
      committeeOptions,
      loadCommittees,
      committeeMenuSignal,
      openCommitteeMenu,
    }),
    [loading, session, refresh, setViewAs, signOut, committeeOptions, loadCommittees, committeeMenuSignal, openCommitteeMenu]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return context;
}
