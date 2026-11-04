'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  Save,
  RotateCcw,
  History,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';
import { ADMIN_MODULES, ACTION_LABELS, type PermissionAction } from '@/lib/admin-modules';
import { useAdminPopup } from '@/context/AdminPopupContext';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED';

interface Grant {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface Committee {
  id: string;
  application_ref: string | null;
  committee_name: string;
  primary_mobile: string;
  address: string | null;
  email: string;
  event_date: string | null;
  application_status: Status;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  last_login_at: string | null;
  permissions: Grant[];
}

interface HistoryEntry {
  id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

const FILTERS: Array<{ key: 'ALL' | Status; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'DEACTIVATED', label: 'Deactivated' },
];

const ASSIGNABLE = ADMIN_MODULES.filter((m) => !m.superAdminOnly);

const STATUS_STYLES: Record<Status, string> = {
  PENDING: 'bg-green-50 text-green-800 border-green-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-pink-50 text-pink-800 border-pink-200',
  DEACTIVATED: 'bg-slate-100 text-slate-700 border-slate-300',
};

function emptyGrant(moduleKey: string): Grant {
  return {
    module_key: moduleKey,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_approve: false,
  };
}

function toGrantMap(permissions: Grant[]): Record<string, Grant> {
  const map: Record<string, Grant> = {};
  ASSIGNABLE.forEach((module) => {
    map[module.key] = permissions.find((p) => p.module_key === module.key) || emptyGrant(module.key);
  });
  return map;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateOnly(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function CommitteeApplicationsView() {
  const { confirm, alert } = useAdminPopup();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/committee-applications', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not load applications.');
        return;
      }
      setCommittees((data.committees || []) as Committee[]);
    } catch {
      setError('Network problem while loading applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { ALL: committees.length, PENDING: 0, APPROVED: 0, REJECTED: 0, DEACTIVATED: 0 } as Record<
      'ALL' | Status,
      number
    >;
    committees.forEach((c) => {
      if (base[c.application_status] !== undefined) base[c.application_status] += 1;
    });
    return base;
  }, [committees]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return committees.filter((c) => {
      if (filter !== 'ALL' && c.application_status !== filter) return false;
      if (!needle) return true;
      return [c.committee_name, c.application_ref, c.primary_mobile, c.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [committees, filter, query]);

  const send = async (payload: Record<string, unknown>, successMessage: string) => {
    setBusyId(String(payload.id || ''));
    try {
      const res = await fetch('/api/committee-applications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        await alert({ type: 'error', title: 'Not changed', message: data.error || 'Request failed.' });
        return false;
      }
      await alert({ type: 'created', title: successMessage, message: '', buttonText: 'Done' });
      await load();
      return true;
    } catch {
      await alert({ type: 'error', title: 'Not changed', message: 'Network problem.' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (committee: Committee, reason: string) => {
    if (!reason.trim()) {
      await alert({ type: 'error', title: 'Reason required', message: 'A rejection reason must be given.' });
      return;
    }
    await send({ id: committee.id, action: 'reject', reason: reason.trim() }, 'Application rejected.');
  };

  const handleDeactivate = async (committee: Committee) => {
    const yes = await confirm({
      title: 'Deactivate committee',
      message: `${committee.committee_name} loses dashboard and protected API access immediately. Their permission grants are kept for reactivation.`,
      confirmText: 'Deactivate',
    });
    if (!yes) return;
    await send({ id: committee.id, action: 'deactivate' }, 'Committee deactivated.');
  };

  const handleReactivate = async (committee: Committee) => {
    const yes = await confirm({
      title: 'Reactivate committee',
      message: `${committee.committee_name} returns to APPROVED with the permissions it had before.`,
      confirmText: 'Reactivate',
    });
    if (!yes) return;
    await send(
      { id: committee.id, action: 'reactivate', permissions: committee.permissions },
      'Committee reactivated.'
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">Committee Applications</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Review registrations, approve them and decide which modules each committee may open.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 px-3 border border-slate-300 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-slate-200 border border-slate-200">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`bg-white px-3 py-3 text-left transition-colors ${
              filter === item.key ? 'bg-green-900 text-white' : 'hover:bg-slate-50'
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider ${filter === item.key ? 'text-green-200' : 'text-slate-500'}`}>
              {item.label === 'All' ? 'Total applications' : item.label}
            </p>
            <p className="mt-1 text-xl font-black">{counts[item.key]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search committee name, application ID, mobile or email"
          className="w-full h-11 pl-9 pr-3 text-sm border border-slate-300 bg-white outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15"
        />
      </div>

      {error && (
        <p className="text-[13px] font-semibold text-pink-800 bg-pink-50 border border-pink-200 px-3 py-2.5">{error}</p>
      )}

      {loading && committees.length === 0 ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="grid place-items-center gap-2 py-16 text-slate-400">
          <Inbox className="w-8 h-8" />
          <p className="text-sm font-bold">No applications match this view.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((committee) => {
            const open = openId === committee.id;
            return (
              <section key={committee.id} className="bg-white border border-slate-200">
                <button
                  onClick={() => setOpenId(open ? null : committee.id)}
                  className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] sm:text-sm font-black text-slate-900 truncate">{committee.committee_name}</p>
                      <span className={`px-2 py-0.5 border text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[committee.application_status]}`}>
                        {committee.application_status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                      {committee.application_ref || '—'} · {committee.primary_mobile} · {committee.email}
                    </p>
                  </div>
                  <span className="hidden sm:block text-[11px] font-bold text-slate-400 whitespace-nowrap">
                    {formatWhen(committee.submitted_at)}
                  </span>
                  {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {open && (
                  <ApplicationDetail
                    committee={committee}
                    busy={busyId === committee.id}
                    onApprove={async (permissions) => {
                      const yes = await confirm({
                        title: 'Approve committee',
                        message: `${committee.committee_name} gets exactly the ${permissions.filter((p) =>
                          [p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_approve].some(Boolean)
                        ).length} module row(s) shown here.`,
                        confirmText: 'Confirm approval',
                      });
                      if (!yes) return;
                      const ok = await send({ id: committee.id, action: 'approve', permissions }, 'Committee approved.');
                      if (ok) setOpenId(null);
                    }}
                    onReject={(reason) => handleReject(committee, reason)}
                    onDeactivate={() => handleDeactivate(committee)}
                    onReactivate={() => handleReactivate(committee)}
                    onSavePermissions={(permissions) =>
                      send({ id: committee.id, action: 'permissions', permissions }, 'Permissions updated.')
                    }
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({
  committee,
  busy,
  onApprove,
  onReject,
  onDeactivate,
  onReactivate,
  onSavePermissions,
}: {
  committee: Committee;
  busy: boolean;
  onApprove: (permissions: Grant[]) => void;
  onReject: (reason: string) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onSavePermissions: (permissions: Grant[]) => void;
}) {
  const [grants, setGrants] = useState<Record<string, Grant>>(() => toGrantMap(committee.permissions));
  const [tab, setTab] = useState<'details' | 'permissions' | 'history'>('details');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    if (tab !== 'history') return;
    let cancelled = false;
    fetch(`/api/committee-applications?committee_id=${committee.id}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHistory((data.history || []) as HistoryEntry[]);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, committee.id]);

  const setCell = (moduleKey: string, action: PermissionAction, value: boolean) => {
    setGrants((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action === 'view' ? 'can_view' : action === 'create' ? 'can_create' : action === 'edit' ? 'can_edit' : action === 'delete' ? 'can_delete' : 'can_approve']: value,
        // A module with no VIEW is invisible in the sidebar, so any action implies view.
        can_view: action === 'view' ? value : value ? true : prev[moduleKey].can_view,
      },
    }));
  };

  const setWholeModule = (moduleKey: string, on: boolean) => {
    setGrants((prev) => ({
      ...prev,
      [moduleKey]: on
        ? {
            module_key: moduleKey,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_approve: true,
          }
        : emptyGrant(moduleKey),
    }));
  };

  const setAll = (on: boolean) => {
    const next: Record<string, Grant> = {};
    ASSIGNABLE.forEach((module) => {
      next[module.key] = on
        ? {
            module_key: module.key,
            can_view: true,
            // Modules that never support an action simply ignore the grant.
            can_create: module.actions.includes('create'),
            can_edit: module.actions.includes('edit'),
            can_delete: module.actions.includes('delete'),
            can_approve: module.actions.includes('approve'),
          }
        : emptyGrant(module.key);
    });
    setGrants(next);
  };

  const payload = ASSIGNABLE.map((module) => grants[module.key]);
  const grantedCount = payload.filter((row) =>
    [row.can_view, row.can_create, row.can_edit, row.can_delete, row.can_approve].some(Boolean)
  ).length;

  return (
    <div className="border-t border-slate-200 bg-slate-50/60">
      <div className="flex gap-px bg-slate-200 border-b border-slate-200">
        {(
          [
            ['details', 'Registration'],
            ['permissions', `Permissions${grantedCount ? ` (${grantedCount})` : ''}`],
            ['history', 'History'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
              tab === key ? 'bg-white text-green-900' : 'bg-slate-50 text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="p-4 space-y-4">
          <dl className="grid sm:grid-cols-2 gap-px bg-slate-200 border border-slate-200">
            {[
              ['Application ID', committee.application_ref || committee.id.slice(0, 8).toUpperCase()],
              ['Status', committee.application_status],
              ['Event date', formatDateOnly(committee.event_date)],
              ['Primary mobile', committee.primary_mobile],
              ['Address', committee.address || '—'],
              ['Email', committee.email],
              ['Submitted', formatWhen(committee.submitted_at)],
              ['Last sign-in', formatWhen(committee.last_login_at)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-[13px] font-bold text-slate-900 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {committee.rejection_reason && (
            <div className="border-l-4 border-pink-600 bg-pink-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-pink-800">Rejection reason</p>
              <p className="mt-1 text-[13px] text-pink-900">{committee.rejection_reason}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'permissions' && (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAll(true)}
              className="h-8 px-3 border border-green-800 text-green-900 text-[11px] font-black uppercase tracking-wider hover:bg-green-50"
            >
              Select all
            </button>
            <button
              onClick={() => setAll(false)}
              className="h-8 px-3 border border-slate-300 text-slate-600 text-[11px] font-black uppercase tracking-wider hover:bg-white"
            >
              Deselect all
            </button>
            <button
              onClick={() => setGrants(toGrantMap(committee.permissions))}
              className="h-8 inline-flex items-center gap-1.5 px-3 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[540px] bg-white border border-slate-200 text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-black px-3 py-2">Module</th>
                  {ASSIGNABLE[0] &&
                    (Object.keys(ACTION_LABELS) as PermissionAction[]).map((action) => (
                      <th key={action} className="font-black px-2 py-2 text-center">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {ASSIGNABLE.map((module) => {
                  const grant = grants[module.key];
                  return (
                    <tr key={module.key} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-bold text-slate-800">{module.label}</td>
                      {(Object.keys(ACTION_LABELS) as PermissionAction[]).map((action) => {
                        const supported = module.actions.includes(action);
                        const field =
                          action === 'view'
                            ? 'can_view'
                            : action === 'create'
                              ? 'can_create'
                              : action === 'edit'
                                ? 'can_edit'
                                : action === 'delete'
                                  ? 'can_delete'
                                  : 'can_approve';
                        return (
                          <td key={action} className="text-center px-2 py-2">
                            {supported ? (
                              <input
                                type="checkbox"
                                checked={Boolean(grant[field])}
                                onChange={(e) => setCell(module.key, action, e.target.checked)}
                                className="w-4 h-4 accent-green-800"
                                aria-label={`${module.label} ${ACTION_LABELS[action]}`}
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => setWholeModule(module.key, !grant.can_view)}
                          className="text-[10px] font-black uppercase tracking-wider text-green-800 hover:text-green-900"
                        >
                          {grant.can_view ? 'Clear' : 'All'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {committee.application_status === 'PENDING' && (
              <button
                onClick={() => onApprove(payload)}
                disabled={busy || grantedCount === 0}
                className="inline-flex h-10 items-center gap-2 px-4 bg-green-800 hover:bg-green-900 disabled:opacity-50 text-white text-[13px] font-bold"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve with these permissions
              </button>
            )}
            {committee.application_status === 'APPROVED' && (
              <button
                onClick={() => onSavePermissions(payload)}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 px-4 bg-green-800 hover:bg-green-900 disabled:opacity-50 text-white text-[13px] font-bold"
              >
                <Save className="w-4 h-4" /> Save permissions
              </button>
            )}
            <p className="self-center text-[11px] text-slate-500">
              {committee.application_status === 'APPROVED'
                ? 'Changes apply on the committee’s next request — no re-registration needed.'
                : 'Grant nothing here and the committee sees an empty sidebar.'}
            </p>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="p-4">
          {history === null ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : history.length === 0 ? (
            <p className="text-[13px] text-slate-500">No recorded actions yet.</p>
          ) : (
            <ul className="space-y-px bg-slate-200 border border-slate-200">
              {history.map((entry) => (
                <li key={entry.id} className="bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[12px] font-black text-slate-800">{entry.action}</p>
                    <p className="ml-auto text-[11px] text-slate-400">{formatWhen(entry.timestamp)}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 break-words">
                    by {entry.performed_by}
                    {Array.isArray(entry.metadata?.modules)
                      ? ` · modules: ${(entry.metadata.modules as string[]).join(', ') || 'none'}`
                      : ''}
                    {entry.metadata?.reason ? ` · reason: ${String(entry.metadata.reason)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 border-t border-slate-200 px-4 py-3 bg-white">
        {committee.application_status !== 'APPROVED' && committee.application_status !== 'DEACTIVATED' && (
          <button
            onClick={() => setRejecting((v) => !v)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 px-3.5 border border-pink-700 text-pink-800 text-[12px] font-bold hover:bg-pink-50 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> {rejecting ? 'Cancel' : 'Reject'}
          </button>
        )}
        {committee.application_status === 'APPROVED' && (
          <button
            onClick={onDeactivate}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 px-3.5 border border-slate-400 text-slate-700 text-[12px] font-bold hover:bg-slate-100 disabled:opacity-50"
          >
            <PowerOff className="w-4 h-4" /> Deactivate
          </button>
        )}
        {committee.application_status === 'DEACTIVATED' && (
          <button
            onClick={onReactivate}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 px-3.5 bg-green-800 text-white text-[12px] font-bold hover:bg-green-900 disabled:opacity-50"
          >
            <Power className="w-4 h-4" /> Reactivate
          </button>
        )}
        {busy && <Loader2 className="w-4 h-4 text-slate-400 animate-spin self-center" />}
      </div>

      {rejecting && (
        <div className="border-t border-pink-200 bg-pink-50 p-4 space-y-2.5">
          <label htmlFor="reject-reason" className="block text-[10px] font-black uppercase tracking-wider text-pink-800">
            Reason shown to the committee
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Registration number and district details do not match."
            className="w-full p-3 text-[13px] border border-pink-300 bg-white outline-none focus:border-pink-700 focus:ring-2 focus:ring-pink-700/15 resize-y"
          />
          <button
            onClick={async () => {
              await onReject(reason);
              setRejecting(false);
              setReason('');
            }}
            disabled={busy || !reason.trim()}
            className="inline-flex h-9 items-center gap-2 px-4 bg-pink-700 hover:bg-pink-800 disabled:opacity-50 text-white text-[12px] font-bold"
          >
            <XCircle className="w-4 h-4" /> Confirm rejection
          </button>
        </div>
      )}
    </div>
  );
}
