'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Loader2, ShieldCheck } from 'lucide-react';
import { useAdminSession } from '@/context/AdminSessionContext';

/**
 * Lets a Super Admin open the panel with one committee's grants instead of
 * signing in as that committee. The list and the switch are decided by the
 * server; this only offers the choices it returns.
 */
export default function CommitteeViewSwitch() {
  const {
    session,
    isSuperAdmin,
    setViewAs,
    committeeOptions: committees,
    loadCommittees,
    committeeMenuSignal,
  } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (isSuperAdmin && committees === null) void loadCommittees();
  }, [isSuperAdmin, committees, loadCommittees]);

  // The profile menu's "Committee Login" asks to pick from here.
  useEffect(() => {
    if (committeeMenuSignal > 0) setOpen(true);
  }, [committeeMenuSignal]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  /*
   * The panel is positioned against the viewport because the column it lives in
   * scrolls, and a scroll container clips whatever spills past its left edge —
   * which is exactly where the sidebar is on a phone. Anchoring it here keeps the
   * whole list on screen instead of cutting off the committee names.
   */
  useEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(340, window.innerWidth - 16);
      setPanelBox({
        width,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        top: rect.bottom + 8,
        maxHeight: Math.max(180, window.innerHeight - rect.bottom - 24),
      });
    }
    const dismiss = () => setOpen(false);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss);
    };
  }, [open, committeeMenuSignal]);

  const apply = async (committeeId: string | null) => {
    setBusy(true);
    setError('');
    const result = await setViewAs(committeeId);
    setBusy(false);
    setOpen(false);
    if (!result.ok) setError(result.error);
  };

  if (!isSuperAdmin || !committees?.length) return null;

  const viewing = session?.viewingAs || null;
  const single = committees.length === 1 ? committees[0] : null;

  if (single) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          disabled={busy}
          onClick={() => (viewing ? apply(null) : apply(single.id))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${
            viewing
              ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50 hover:bg-amber-400/30'
              : 'bg-white/10 text-white border border-white/15 hover:border-amber-400/50 hover:bg-white/15'
          }`}
          title={viewing ? 'Leave the committee view' : `Open the panel as ${single.name}`}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : viewing ? (
            <ShieldCheck className="w-3.5 h-3.5" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="max-w-[150px] truncate">
            {viewing ? 'Exit committee view' : `As ${single.name}`}
          </span>
        </button>
        {error && <p className="absolute right-0 mt-1 text-[10px] font-bold text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
          viewing
            ? 'bg-amber-400/20 text-amber-200 border-amber-400/50 hover:bg-amber-400/30'
            : 'bg-white/10 text-white border-white/15 hover:border-amber-400/50 hover:bg-white/15'
        }`}
        title="Switch into a committee view"
      >
        {viewing ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5 text-amber-400" />}
        <span className="max-w-[150px] truncate">{viewing ? viewing.committeeName : 'Committee view'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && panelBox && (
        <div
          style={{ position: 'fixed', top: panelBox.top, left: panelBox.left, width: panelBox.width, maxHeight: panelBox.maxHeight }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2.5 z-[120] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-2.5 py-1.5 mb-2 flex items-center justify-between border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Open panel as committee
            </span>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {committees.length}
            </span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => apply(null)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left mb-1 transition-colors disabled:opacity-60 ${
              !viewing ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${!viewing ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="flex-1 text-xs font-bold">Full Super Admin view</span>
            {!viewing && <Check className="w-4 h-4 text-indigo-600" />}
          </button>

          {committees.map((option) => {
            const active = viewing?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => apply(option.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors disabled:opacity-60 ${
                  active ? 'bg-amber-50 text-amber-900' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Building2 className={`w-4 h-4 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate">{option.name}</span>
                  <span className="block text-[10px] font-semibold text-slate-400">{option.applicationRef}</span>
                </span>
                {active && <Check className="w-4 h-4 text-amber-600" />}
              </button>
            );
          })}

          {error && <p className="mt-1.5 px-2.5 text-[11px] font-bold text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
