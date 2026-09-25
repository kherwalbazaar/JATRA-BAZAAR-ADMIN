'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Eye,
  ShieldCheck,
  Clock,
  Camera,
  X,
  CalendarDays,
  Ban,
  UserCheck,
} from 'lucide-react';
import { ScannerMember, TicketEntry } from '@/types';
import * as fs from '@/lib/firestore';

const approvalBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: '🟠 Pending', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '🟢 Approved', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: '🔴 Rejected', cls: 'bg-red-100 text-red-800 border-red-200' },
};

const accountBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '🟢 Active', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  deactivated: { label: '⚫ Deactivated', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

interface ConfirmState {
  member: ScannerMember;
  action: 'approve' | 'reject' | 'deactivate' | 'activate';
}

interface AddForm {
  name: string;
  mobile: string;
  email: string;
  profilePhoto: string;
}

export default function ScannerMembersView() {
  const [members, setMembers] = useState<ScannerMember[]>([]);
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [viewing, setViewing] = useState<ScannerMember | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AddForm>({ name: '', mobile: '', email: '', profilePhoto: '' });

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(fs.listenScannerMembers((m) => { setMembers(m); setLoading(false); }, () => setLoading(false)));
    } catch {
      setLoading(false);
    }
    try {
      unsubs.push(fs.listenTicketEntries(setEntries, () => {}));
    } catch {
      /* ignore */
    }
    return () => unsubs.forEach((u) => u());
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const todaysEntries = entries.filter((e) => (e.scannedAt || '').startsWith(today));
    return {
      total: members.length,
      approved: members.filter((m) => m.approvalStatus === 'approved').length,
      pending: members.filter((m) => m.approvalStatus === 'pending').length,
      rejected: members.filter((m) => m.approvalStatus === 'rejected').length,
      active: members.filter((m) => m.accountStatus === 'active').length,
      deactivated: members.filter((m) => m.accountStatus === 'deactivated').length,
      todayTotal: todaysEntries.length,
      todaySuccess: todaysEntries.filter((e) => e.scanResult === 'SUCCESS').length,
      todayDuplicate: todaysEntries.filter((e) => e.scanResult === 'ALREADY_USED').length,
      todayInvalid: todaysEntries.filter((e) => e.scanResult === 'INVALID' || e.scanResult === 'WRONG_EVENT').length,
      todayCancelled: todaysEntries.filter((e) => e.scanResult === 'CANCELLED' || e.scanResult === 'UNPAID').length,
    };
  }, [members, entries, today]);

  const todayScansFor = (m: ScannerMember) =>
    entries.filter((e) => e.memberId === m.id && e.entryStatus === 'entered' && (e.scannedAt || '').startsWith(today)).length;

  const applyAction = async () => {
    if (!confirm) return;
    const { member, action } = confirm;
    setSaving(true);
    const now = new Date().toISOString();
    try {
      if (action === 'approve') {
        await fs.updateScannerMember(member.id, {
          approvalStatus: 'approved',
          approvedAt: now,
          approvedBy: 'admin',
        });
        await fs.writeAuditLog({ action: 'scanner.approved', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else if (action === 'reject') {
        await fs.updateScannerMember(member.id, { approvalStatus: 'rejected' });
        await fs.writeAuditLog({ action: 'scanner.rejected', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else if (action === 'deactivate') {
        // Deactivation must NOT change approval status
        await fs.updateScannerMember(member.id, {
          accountStatus: 'deactivated',
          deactivatedAt: now,
          deactivatedBy: 'admin',
        });
        await fs.writeAuditLog({ action: 'scanner.deactivated', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else if (action === 'activate') {
        await fs.updateScannerMember(member.id, { accountStatus: 'active', deactivatedAt: '', deactivatedBy: '' });
        await fs.writeAuditLog({ action: 'scanner.activated', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      }
    } catch (err) {
      console.error('Scanner status change failed:', err);
      alert('Failed to update scanner member. Try again.');
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim() || !form.email.trim()) {
      alert('Please fill Full Name, Mobile Number and Email.');
      return;
    }
    setSaving(true);
    try {
      const created = await fs.addScannerMember({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        profilePhoto: form.profilePhoto.trim(),
      });
      alert(`Scanner added: ${created.scannerId} (pending approval)`);
      setForm({ name: '', mobile: '', email: '', profilePhoto: '' });
      setAddOpen(false);
    } catch (err) {
      console.error('Add scanner failed:', err);
      alert('Failed to add scanner member.');
    } finally {
      setSaving(false);
    }
  };

  const confirmCopy = (c: ConfirmState) => {
    const n = c.member.name;
    switch (c.action) {
      case 'approve':
        return { title: 'Approve Scanner?', body: `${n} will be able to scan audience tickets once approved and active.`, btn: 'Approve', btnCls: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'reject':
        return { title: 'Reject Scanner?', body: `${n} will no longer be able to access the scanner.`, btn: 'Reject', btnCls: 'bg-red-600 hover:bg-red-700' };
      case 'deactivate':
        return { title: 'Deactivate Scanner?', body: `${n} will no longer be able to scan audience tickets.`, btn: 'Deactivate', btnCls: 'bg-slate-700 hover:bg-slate-800' };
      case 'activate':
        return { title: 'Activate Scanner?', body: `${n} will be able to scan audience tickets again (if approved).`, btn: 'Activate', btnCls: 'bg-emerald-600 hover:bg-emerald-700' };
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Scanner Members</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {members.length} Members
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Manage who can scan tickets. Only <b>Approved + Active</b> members can scan.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Scanner</span>
        </button>
      </div>

      {/* Dashboard summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Scanners', value: stats.total, icon: <Users className="w-4 h-4" />, cls: 'text-indigo-600 bg-indigo-50' },
          { label: 'Approved', value: stats.approved, icon: <CheckCircle2 className="w-4 h-4" />, cls: 'text-emerald-600 bg-emerald-50' },
          { label: 'Pending', value: stats.pending, icon: <Clock className="w-4 h-4" />, cls: 'text-amber-600 bg-amber-50' },
          { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-4 h-4" />, cls: 'text-red-600 bg-red-50' },
          { label: 'Active', value: stats.active, icon: <PlayCircle className="w-4 h-4" />, cls: 'text-emerald-600 bg-emerald-50' },
          { label: 'Deactivated', value: stats.deactivated, icon: <Ban className="w-4 h-4" />, cls: 'text-slate-600 bg-slate-100' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.cls}`}>{s.icon}</div>
            <div>
              <span className="text-lg font-black text-slate-900 leading-none block">{s.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Entry statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Today's Total Entries", value: stats.todayTotal },
          { label: 'Successful Scans', value: stats.todaySuccess },
          { label: 'Duplicate Scans', value: stats.todayDuplicate },
          { label: 'Invalid Scans', value: stats.todayInvalid },
          { label: 'Cancelled / Unpaid', value: stats.todayCancelled },
        ].map((s) => (
          <div key={s.label} className="bg-[#0f1430] rounded-xl p-3.5 text-white">
            <span className="text-xl font-black leading-none block">{s.value}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 block">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Member list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 py-10 justify-center">
          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading scanner members...
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600">No scanner members yet</p>
          <p className="text-xs text-slate-400 font-semibold mt-1">Add your first scanner member to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
          {/* Header row (desktop) */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <div className="col-span-3">Member</div>
            <div className="col-span-2">Scanner ID / Mobile</div>
            <div className="col-span-2">Approval</div>
            <div className="col-span-2">Account</div>
            <div className="col-span-1">Scans (Today/Total)</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {members.map((m) => {
            const appr = approvalBadge[m.approvalStatus] || approvalBadge.pending;
            const acct = accountBadge[m.accountStatus] || accountBadge.active;
            const canScan = m.approvalStatus === 'approved' && m.accountStatus === 'active';
            return (
              <div key={m.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-2 px-4 py-3 items-center hover:bg-slate-50/70 transition-colors">
                {/* Member */}
                <div className="lg:col-span-3 flex items-center gap-2.5 min-w-0">
                  {m.profilePhoto ? (
                    <img src={m.profilePhoto} alt={m.name} className="w-9 h-9 rounded-full object-cover bg-slate-100 flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">{m.name}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block truncate">{m.email}</span>
                  </div>
                </div>

                {/* Scanner ID / Mobile */}
                <div className="lg:col-span-2">
                  <span className="text-[11px] font-black text-indigo-700 font-mono block">{m.scannerId}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{m.mobile}</span>
                </div>

                {/* Approval badge */}
                <div className="lg:col-span-2">
                  <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-full border ${appr.cls}`}>{appr.label}</span>
                </div>

                {/* Account badge */}
                <div className="lg:col-span-2">
                  <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-full border ${acct.cls}`}>{acct.label}</span>
                  {canScan && (
                    <span className="ml-1.5 text-[9px] font-black text-emerald-600 uppercase">can scan</span>
                  )}
                </div>

                {/* Scans */}
                <div className="lg:col-span-1 text-[11px] font-bold text-slate-600">
                  {todayScansFor(m)} / {m.totalScans || 0}
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">today/total</span>
                </div>

                {/* Actions */}
                <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {/* Pending */}
                  {m.approvalStatus === 'pending' && (
                    <>
                      <button onClick={() => setConfirm({ member: m, action: 'approve' })} className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => setConfirm({ member: m, action: 'reject' })} className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black rounded-lg flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}

                  {/* Approved + Active */}
                  {m.approvalStatus === 'approved' && m.accountStatus === 'active' && (
                    <button onClick={() => setConfirm({ member: m, action: 'deactivate' })} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                      <PauseCircle className="w-3 h-3" /> Deactivate
                    </button>
                  )}

                  {/* Approved + Deactivated */}
                  {m.approvalStatus === 'approved' && m.accountStatus === 'deactivated' && (
                    <button onClick={() => setConfirm({ member: m, action: 'activate' })} className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" /> Activate
                    </button>
                  )}

                  {/* Rejected */}
                  {m.approvalStatus === 'rejected' && (
                    <button onClick={() => setConfirm({ member: m, action: 'approve' })} className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Approve
                    </button>
                  )}

                  {/* View (always) */}
                  <button onClick={() => setViewing(m)} className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirm && (() => {
        const c = confirmCopy(confirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setConfirm(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-200">
              <h3 className="text-sm font-black text-slate-800 mb-1.5">{c.title}</h3>
              <p className="text-xs font-semibold text-slate-500 mb-5">{c.body}</p>
              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyAction}
                  disabled={saving}
                  className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50 ${c.btnCls}`}
                >
                  {saving ? 'Working...' : c.btn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View details modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
              <span className="text-xs font-black tracking-wide">Scanner Details</span>
              <button onClick={() => setViewing(null)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="flex items-center gap-3">
                {viewing.profilePhoto ? (
                  <img src={viewing.profilePhoto} alt={viewing.name} className="w-14 h-14 rounded-full object-cover bg-slate-100" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-lg">
                    {viewing.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-sm font-black text-slate-900 block">{viewing.name}</span>
                  <span className="text-[11px] font-black text-indigo-700 font-mono">{viewing.scannerId}</span>
                  <div className="flex gap-1.5 mt-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${(approvalBadge[viewing.approvalStatus] || approvalBadge.pending).cls}`}>
                      {(approvalBadge[viewing.approvalStatus] || approvalBadge.pending).label}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${(accountBadge[viewing.accountStatus] || accountBadge.active).cls}`}>
                      {(accountBadge[viewing.accountStatus] || accountBadge.active).label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ['Mobile', viewing.mobile],
                  ['Email', viewing.email],
                  ['Created Date', viewing.createdAt ? new Date(viewing.createdAt).toLocaleString('en-IN') : '—'],
                  ['Last Active', viewing.lastScanAt ? new Date(viewing.lastScanAt).toLocaleString('en-IN') : '—'],
                  ['Total Scans', String(viewing.totalScans || 0)],
                  ["Total Scans", String(todayScansFor(viewing))],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">{k}</span>
                    <span className="text-[11px] font-bold text-slate-800 break-words">{v}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-semibold text-slate-400">
                Assigned Gate: <span className="text-slate-600 font-bold">{viewing.assignedGateId || 'Not assigned'}</span>
                {viewing.approvedAt && <> • Approved: {new Date(viewing.approvedAt).toLocaleString('en-IN')}</>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add scanner modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black tracking-wide">Add Scanner Member</span>
              </div>
              <button onClick={() => setAddOpen(false)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Balakram Tudu"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="member@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Profile Photo URL</label>
                <input
                  type="text"
                  value={form.profilePhoto}
                  onChange={(e) => setForm((f) => ({ ...f, profilePhoto: e.target.value }))}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
                {form.profilePhoto.trim() && (
                  <div className="mt-2 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.profilePhoto.trim()}
                      alt="Profile preview"
                      className="w-12 h-12 rounded-full object-cover bg-slate-100 flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Preview</span>
                      <span className="text-[10px] font-bold text-slate-600 block truncate">{form.name || 'New Scanner'}</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] font-semibold text-slate-400">
                A unique Scanner ID (SCN-xxx) is generated automatically. New members start as <b>Pending</b> and cannot scan until approved.
              </p>
              <div className="pt-1 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Scanner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
