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

export interface PanelSession {
  signedIn: boolean;
  canEnterDashboard: boolean;
  role: 'super_admin' | 'committee';
  user: PanelUser;
  permissions: Record<string, string[]>;
  allowedTabs: NavigationTab[];
  committee: {
    id: string;
    applicationRef: string;
    committeeName: string;
    status: CommitteeStatus;
    rejectionReason: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    lastLoginAt: string | null;
  } | null;
}

interface SessionContextValue {
  loading: boolean;
  session: PanelSession | null;
  isSuperAdmin: boolean;
  refresh: () => Promise<PanelSession | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PanelSession | null>(null);
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
      signOut,
    }),
    [loading, session, refresh, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return context;
}
