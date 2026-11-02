'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  MoreVertical,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Eye,
  Pencil,
  Users,
  X,
  Smartphone,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ScannerMember, TicketEntry } from '@/types';
import * as fs from '@/lib/firestore';
import { useAdminPopup } from '@/context/AdminPopupContext';

const approvalBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};
const approvalLabel: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};
const accountBadge: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  deactivated: 'bg-slate-200 text-slate-700 border-slate-300',
};
const accountLabel: Record<string, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
};

export default function ScannerMemberList() {
  const { alert: adminAlert } = useAdminPopup();
  const [members, setMembers] = useState<ScannerMember[]>([]);
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ScannerMember | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editing, setEditing] = useState<ScannerMember | null>(null);
  const [editForm, setEditForm] = useState({ name: '', mobile: '', email: '', profilePhoto: '' });
  const [confirm, setConfirm] = useState<{
    member: ScannerMember;
    action: 'approve' | 'reject' | 'deactivate' | 'activate';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!menuFor) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-member-menu]') || t?.closest('[data-member-menu-btn]')) return;
      setMenuFor(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [menuFor]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(fs.listenScannerMembers((m) => { setMembers(m); setLoading(false); }, () => setLoading(false)));
    } catch {
      setLoading(false);
    }
    try {
      unsubs.push(fs.listenTicketEntries(setEntries));
    } catch {
      /* ignore */
    }

    // Pull scanner accounts registered in the SCANNER app (Supabase-only) into Firestore.
    void fs.syncScannerMembersFromSupabase();
    const onFocus = () => { void fs.syncScannerMembersFromSupabase(); };
    window.addEventListener('focus', onFocus);

    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const today = fs.todayStr();

  const connectPayload = useMemo(() => {
    if (!viewing) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return JSON.stringify({
      app: 'JATRA_QR',
      type: 'scanner_connect',
      scannerId: viewing.scannerId,
      memberId: viewing.id,
      name: viewing.name,
      gate: viewing.assignedGateId || '',
      url: origin ? `${origin}/scanner?connect=${encodeURIComponent(viewing.scannerId)}` : '',
      iat: Date.now(),
    });
  }, [viewing]);

  const todayScans = (memberId: string) =>
    entries.filter(
      (e) =>
        (e.memberId === memberId || e.scannerId === memberId) &&
        e.entryStatus === 'entered' &&
        (e.scanDate === today || (e.scannedAt || '').slice(0, 10) === today)
    ).length;

  const applyAction = async () => {
    if (!confirm) return;
    const { member, action } = confirm;
    setSaving(true);
    const now = new Date().toISOString();
    try {
      if (action === 'approve') {
        await fs.updateScannerMember(member.id, { approvalStatus: 'approved', approvedAt: now, approvedBy: 'admin' });
        await fs.writeAuditLog({ action: 'scanner.approved', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else if (action === 'reject') {
        await fs.updateScannerMember(member.id, { approvalStatus: 'rejected' });
        await fs.writeAuditLog({ action: 'scanner.rejected', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else if (action === 'deactivate') {
        await fs.updateScannerMember(member.id, { accountStatus: 'deactivated', deactivatedAt: now, deactivatedBy: 'admin' });
        await fs.writeAuditLog({ action: 'scanner.deactivated', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      } else {
        await fs.updateScannerMember(member.id, { accountStatus: 'active', deactivatedAt: '', deactivatedBy: '' });
        await fs.writeAuditLog({ action: 'scanner.activated', performedBy: 'admin', targetId: member.id, metadata: { scannerId: member.scannerId, name: member.name } });
      }
    } catch (err) {
      console.error('Scanner status change failed:', err);
      adminAlert({
        title: 'Status Update Failed',
        subtitle: 'Scanner Member Error',
        message: err instanceof Error ? err.message : 'Failed to update scanner member status. Please try again.',
        type: 'error',
      });
    } finally {
      setSaving(false);
      setConfirm(null);
      setMenuFor(null);
    }
  };

  const openEdit = (m: ScannerMember) => {
    setMenuFor(null);
    setEditForm({ name: m.name, mobile: m.mobile || '', email: m.email || '', profilePhoto: m.profilePhoto || '' });
    setEditing(m);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.name.trim() || !editForm.mobile.trim() || !editForm.email.trim()) {
      adminAlert({
        title: 'Required Information Missing',
        subtitle: 'Validation Warning',
        message: 'Name, Mobile Number, and Email are required to update this scanner member.',
        type: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await fs.updateScannerMember(editing.id, {
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        email: editForm.email.trim(),
        profilePhoto: editForm.profilePhoto.trim(),
      });
      await fs.writeAuditLog({
        action: 'scanner.updated',
        performedBy: 'admin',
        targetId: editing.id,
        metadata: { scannerId: editing.scannerId, name: editForm.name.trim() },
      });
      setEditing(null);
      await adminAlert({
        title: 'Scanner Member Updated!',
        subtitle: 'Profile Changes Saved',
        message: `Member profile details for "${editForm.name.trim()}" (${editing.scannerId}) have been updated successfully.`,
        type: 'updated',
        itemTitle: editForm.name.trim(),
        itemSubtitle: editForm.email.trim(),
      });
    } catch (err) {
      console.error('Update member failed:', err);
      adminAlert({
        title: 'Update Failed',
        subtitle: 'Database Error',
        message: err instanceof Error ? err.message : 'Failed to update member. Please try again.',
        type: 'error',
      });
    } finally {
      setSaving(false);
      setMenuFor(null);
    }
  };

  const confirmCopy = (c: NonNullable<typeof confirm>) => {
    const n = c.member.name;
    switch (c.action) {
      case 'approve':
        return {
          title: 'Approve Scanner?',
          subtitle: 'Authorize Gate Access',
          body: `${n} will be authorized to scan audience tickets at gates once approved and active.`,
          btn: 'Approve Member',
          gradient: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600',
          btnGradient: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25',
          Icon: CheckCircle2,
        };
      case 'reject':
        return {
          title: 'Reject Scanner?',
          subtitle: 'Deny Scanner Access',
          body: `${n} will be rejected and will not be able to log in or scan audience tickets.`,
          btn: 'Reject Access',
          gradient: 'bg-gradient-to-br from-rose-600 via-pink-600 to-red-600',
          btnGradient: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25',
          Icon: XCircle,
        };
      case 'deactivate':
        return {
          title: 'Deactivate Scanner?',
          subtitle: 'Temporary Suspension',
          body: `${n} will be temporarily suspended from scanning tickets until reactivated.`,
          btn: 'Deactivate Scanner',
          gradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600',
          btnGradient: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-orange-500/25',
          Icon: PauseCircle,
        };
      default:
        return {
          title: 'Activate Scanner?',
          subtitle: 'Restore Access',
          body: `${n} will have their scanning account reactivated and can resume gate scanning.`,
          btn: 'Reactivate Scanner',
          gradient: 'bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600',
          btnGradient: 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-emerald-500/25',
          Icon: PlayCircle,
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-5">
      {/* Member List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Member List
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {members.length} Members
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 py-10 justify-center bg-white rounded-2xl border border-slate-200/80">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-300 flex-1 flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-black text-slate-600">No scanner members yet</p>
            <p className="text-xs text-slate-400 font-semibold mt-1">Add members from the Scanner Members section.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <th className="text-left px-4 py-3">Member</th>
                    <th className="text-left px-4 py-3">Scanner ID</th>
                    <th className="text-left px-4 py-3">Approval</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Today&apos;s Scans</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors border-b border-slate-200 last:border-b-0"
                    onClick={() => setViewing(m)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {m.profilePhoto ? (
                          <img src={m.profilePhoto} alt={m.name} className="w-8 h-8 rounded-full object-cover bg-slate-100 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                            {m.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="font-black text-slate-900">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-indigo-700">{m.scannerId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-full border ${approvalBadge[m.approvalStatus] || approvalBadge.pending}`}>
                        {approvalLabel[m.approvalStatus] || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-full border ${accountBadge[m.accountStatus] || accountBadge.active}`}>
                        {accountLabel[m.accountStatus] || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-800">{todayScans(m.id)}</td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        data-member-menu-btn
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === m.id ? null : m.id);
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 inline-flex items-center justify-center transition-colors"
                        aria-label="Member actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuFor === m.id && (
                        <div
                          data-member-menu
                          className="absolute right-4 top-11 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-40 text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setMenuFor(null);
                              setViewing(m);
                              setConnectOpen(false);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(m);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          {(m.approvalStatus === 'pending' || m.approvalStatus === 'rejected') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                setConfirm({ member: m, action: 'approve' });
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {m.approvalStatus === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                setConfirm({ member: m, action: 'reject' });
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                          {m.approvalStatus === 'approved' && m.accountStatus === 'active' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                setConfirm({ member: m, action: 'deactivate' });
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <PauseCircle className="w-3.5 h-3.5" /> Deactivate
                            </button>
                          )}
                          {m.approvalStatus === 'approved' && m.accountStatus === 'deactivated' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                setConfirm({ member: m, action: 'activate' });
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                            >
                              <PlayCircle className="w-3.5 h-3.5" /> Activate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Member Information (click a member to open details) */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setViewing(null); setConnectOpen(false); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
              <span className="text-xs font-black tracking-wide">Member Information</span>
              <button onClick={() => { setViewing(null); setConnectOpen(false); }} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 text-xs">
              {/* Profile */}
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100 mb-4">
                {viewing.profilePhoto ? (
                  <img src={viewing.profilePhoto} alt={viewing.name} className="w-20 h-20 rounded-full object-cover bg-slate-100 mb-3" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-2xl mb-3">
                    {viewing.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-black text-slate-900">{viewing.name}</span>
                <span className="text-[11px] font-black text-indigo-700 font-mono mt-0.5">{viewing.scannerId}</span>
                <div className="flex gap-1.5 mt-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${approvalBadge[viewing.approvalStatus] || approvalBadge.pending}`}>
                    {approvalLabel[viewing.approvalStatus] || 'Pending'}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${accountBadge[viewing.accountStatus] || accountBadge.active}`}>
                    {accountLabel[viewing.accountStatus] || 'Active'}
                  </span>
                </div>

                {/* Connect Device — right under Approved / Active */}
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="mt-3 -mx-5 w-[calc(100%+2.5rem)] flex items-center justify-between gap-2 bg-[#0f1430] hover:bg-[#1a2148] text-white px-5 py-2.5 transition-colors"
                >
                  <span className="flex items-center gap-2 text-[11px] font-black">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    Connect Device
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 border bg-white/10 border-white/15 text-slate-300">
                    Show QR
                  </span>
                </button>
              </div>

              {/* Fields */}
              <div className="mt-4 space-y-2.5">
                {[
                  ['Full Name', viewing.name],
                  ['Scanner ID', viewing.scannerId],
                  ['Mobile', viewing.mobile || '—'],
                  ['Email', viewing.email || '—'],
                  ['Joined Date', viewing.createdAt ? new Date(viewing.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex-shrink-0">{k}</span>
                    <span className="text-[11px] font-bold text-slate-800 text-right break-words">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Device QR popup */}
      {connectOpen && viewing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => setConnectOpen(false)} />
          <div className="relative bg-white shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-black tracking-wide">Connect Device — {viewing.scannerId}</span>
              </div>
              <button onClick={() => setConnectOpen(false)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col items-center px-5 py-5">
              <div className="bg-white p-3 border border-slate-200 shadow-xs">
                <QRCodeSVG value={connectPayload} size={180} level="M" includeMargin={false} />
              </div>
              <div className="flex items-center gap-1.5 mt-3.5 text-slate-700">
                <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[11px] font-black">Scan with JATRA QR App</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 text-center mt-1.5 leading-relaxed">
                Device will auto-login as <span className="font-black text-indigo-700 font-mono">{viewing.scannerId}</span>
                {viewing.assignedGateId ? ` · Gate ${viewing.assignedGateId}` : ''}
              </p>
              <p className="text-[9px] font-bold text-slate-400 text-center mt-1.5">
                Requires approved + active status
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit member modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-black tracking-wide">Edit Member — {editing.scannerId}</span>
              </div>
              <button onClick={() => setEditing(null)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.mobile}
                    onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Profile Photo URL</label>
                <input
                  type="text"
                  value={editForm.profilePhoto}
                  onChange={(e) => setEditForm((f) => ({ ...f, profilePhoto: e.target.value }))}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
                {editForm.profilePhoto.trim() && (
                  <div className="mt-2 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editForm.profilePhoto.trim()}
                      alt="Preview"
                      className="w-10 h-10 rounded-full object-cover bg-slate-100 flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-[10px] font-bold text-slate-600 truncate">{editForm.name}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
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
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirm && (() => {
        const c = confirmCopy(confirm);
        const Icon = c.Icon;
        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
              onClick={() => !saving && setConfirm(null)}
            />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.35)] overflow-hidden border border-white/20 animate-in zoom-in-95 fade-in duration-200 z-10 my-auto">
              <div className={`relative ${c.gradient} px-6 pt-7 pb-8 text-center text-white overflow-hidden`}>
                <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-white/10 blur-xs pointer-events-none" />
                <div className="absolute -bottom-14 -right-8 w-40 h-40 rounded-full bg-white/10 blur-xs pointer-events-none" />
                <div className="absolute top-4 right-12 w-8 h-8 rounded-full bg-white/15 pointer-events-none" />

                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={saving}
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 active:scale-95 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="relative inline-flex items-center justify-center w-18 h-18 rounded-3xl bg-white/20 backdrop-blur-md mb-3 shadow-xl ring-4 ring-white/20">
                  <Icon className="w-9 h-9 text-white drop-shadow-md" />
                </div>

                <h3 className="text-xl font-black text-white tracking-tight drop-shadow-sm">
                  {c.title}
                </h3>
                <p className="text-[11px] font-extrabold text-white/85 tracking-wider uppercase mt-1">
                  {c.subtitle}
                </p>
              </div>

              <div className="px-6 py-5 space-y-4">
                <p className="text-sm font-semibold text-slate-600 text-center leading-relaxed">
                  {c.body}
                </p>

                <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-slate-50 to-slate-100/90 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center flex-shrink-0 text-slate-700">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 truncate">
                      {confirm.member.name}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 font-mono truncate">
                      {confirm.member.scannerId} • {confirm.member.mobile || 'No Mobile'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs font-black rounded-2xl transition-all duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyAction}
                  disabled={saving}
                  className={`flex-1 py-3 px-4 text-white text-xs font-black rounded-2xl shadow-md active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-60 ${c.btnGradient}`}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating…</span>
                    </>
                  ) : (
                    <span>{c.btn}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
