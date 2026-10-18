'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  RotateCcw,
  Monitor,
  Store,
  Layers,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import StageDiagram, { buildSeatStats } from '@/components/StageDiagram';
import { BlockCategory, defaultBlockCategories } from '@/lib/blockCategories';
import { useBlockCategories } from '@/hooks/useBlockCategories';
import { Seat } from '@/types';

const DIAGRAM_BLOCKS = ['C2', 'A2', 'C3', 'C1', 'A1', 'A3', 'B1', 'B2', 'B3'];

export default function DiagramSettingsView({ seats = [] }: { seats?: Seat[] }) {
  const {
    blocks,
    setBlocks,
    labels,
    channelLabels,
    disabledBlocks,
    loading,
    error: sbError,
    updatingId,
    setBlockChannel,
    setBlockName,
    reload,
  } = useBlockCategories();
  const seatStats = useMemo(() => buildSeatStats(seats), [seats]);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    id: string;
    name: string;
    targetMode: 'online' | 'counter';
  } | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingToggle(null);
    };
    if (pendingToggle) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [pendingToggle]);

  // "Saved" indicator whenever the block set changes (skips the initial load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1400);
    return () => clearTimeout(t);
  }, [blocks]);

  const patch = (id: string, changes: Partial<BlockCategory>, immediate = false) =>
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)), immediate);

  /** Execute channel switch with direct Supabase persistence, instant optimistic UI, and rollback */
  const handleExecuteToggle = async () => {
    if (!pendingToggle) return;
    const { id, targetMode } = pendingToggle;
    setPendingToggle(null);

    const res = await setBlockChannel(id, targetMode);
    if (!res.success) {
      setFormError(`Failed to update ${id} in Supabase: ${res.error}. Database status restored.`);
      setTimeout(() => setFormError(''), 6000);
    } else {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    }
  };

  const removeBlock = (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    if (target.builtin) {
      setFormError(`"${target.id}" is a built-in block — disable it instead of deleting.`);
      setTimeout(() => setFormError(''), 3000);
      return;
    }
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const addBlock = () => {
    const id = newId.trim().toUpperCase();
    const name = (newName.trim() || id).toUpperCase();
    if (!id) return setFormError('Block category ID is required.');
    if (!/^[A-Z0-9 _-]+$/.test(id)) return setFormError('ID may only contain letters, numbers, spaces, - and _.');
    if (blocks.some((b) => b.id === id)) return setFormError(`Block "${id}" already exists.`);
    setBlocks([
      ...blocks,
      { id, name, enabled: false, online: false, counter: true, builtin: false }
    ]);
    setNewId('');
    setNewName('');
    setFormError('');
    setAddOpen(false);
  };

  const resetDefaults = () => {
    setBlocks(defaultBlockCategories());
    setConfirmReset(false);
  };

  const stats = useMemo(() => {
    const onlineMode = blocks.filter((b) => b.online).length;
    const counterMode = blocks.filter((b) => b.counter).length;
    return {
      total: blocks.length,
      enabled: onlineMode,
      disabled: counterMode,
      online: onlineMode,
      counter: counterMode
    };
  }, [blocks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter((b) => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  }, [blocks, query]);

  return (
    <div className="px-6 pt-6 pb-6 space-y-5">
      {/* Heading + actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Diagram — Block Categories</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage block seating categories and configure real-time online ticket sales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black uppercase px-2 py-1 rounded-md transition-opacity duration-300 ${
              savedFlash ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 opacity-100' : 'opacity-0'
            }`}
          >
            Saved
          </span>
          {confirmReset ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold text-amber-800">Reset everything?</span>
              <button
                onClick={resetDefaults}
                className="text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-md transition-colors"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-[11px] font-black text-amber-700 hover:text-amber-900 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          )}
          <button
            onClick={() => setAddOpen((o) => !o)}
            className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            title="Add Block Category / Online Status"
          >
            <Plus className="w-4 h-4" />
            Online Status
          </button>
        </div>
      </div>

      {formError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {formError}
        </div>
      )}

      {/* Add form */}
      {addOpen && (
        <div className="border border-indigo-200 bg-indigo-50/60 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-black text-indigo-900 uppercase tracking-wide">New Block Category</p>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Block ID</span>
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlock()}
                placeholder="e.g. E1"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Display Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlock()}
                placeholder="e.g. East Gallery"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={addBlock}
                className="px-4 py-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddOpen(false);
                  setFormError('');
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: 'Total', value: stats.total, cls: 'bg-slate-100 border-slate-200 text-slate-700' },
          { label: 'Online Active (Status ON)', value: stats.online, cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
          { label: 'Counter Selling (Status OFF)', value: stats.counter, cls: 'bg-amber-50 border-amber-200 text-amber-800' }
        ].map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 rounded-xl text-xs font-bold ${s.cls}`}
          >
            {s.label}: <span className="font-black">{s.value}</span>
          </span>
        ))}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search block ID / name..."
            className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[450px_1fr] xl:grid-cols-[470px_1fr] gap-6 items-stretch">
        {/* Block table section */}
        <div className="flex flex-col h-full space-y-2">
          <div className="flex items-center gap-2 px-1 h-5">
            <Store className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">Block Channel Configuration</h3>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">{visible.length} blocks</span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs flex-1 flex flex-col">
            <div className="grid grid-cols-[32px_1fr_96px_72px_32px] gap-2 items-center px-3 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 flex-shrink-0">
              <span>#</span>
              <span>Block Name</span>
              <span className="text-center">Status</span>
              <span className="text-center">Action</span>
              <span />
            </div>

            {(sbError || formError) && (
              <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="truncate">{formError || sbError}</span>
                </div>
                {sbError && (
                  <button
                    onClick={() => reload(true)}
                    className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg flex items-center gap-1 flex-shrink-0 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <div key={n} className="h-9 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-bold text-slate-400 flex-1 flex items-center justify-center">
                No block categories match “{query}”.
              </div>
            ) : (
              <div className="p-2 space-y-1.5 bg-slate-50/40 flex-1 flex flex-col justify-between overflow-y-auto">
                {visible.map((b, i) => {
                  return (
                    <div
                      key={b.id}
                      onMouseEnter={() => setActiveBlock(b.id)}
                      onMouseLeave={() => setActiveBlock(null)}
                      className={`grid grid-cols-[32px_1fr_96px_72px_32px] gap-2 items-center px-3 py-1.5 rounded-xl border transition-all ${
                        activeBlock === b.id
                          ? 'bg-indigo-50/80 border-indigo-200 shadow-xs'
                          : b.online
                            ? 'bg-emerald-50/50 border-emerald-200/80 hover:bg-emerald-50 hover:border-emerald-300'
                            : 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          value={b.name}
                          onChange={(e) => setBlockName(b.id, e.target.value)}
                          className="min-w-0 flex-1 px-2 py-1 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-800 transition-all"
                          title={`Block ID: ${b.id}${DIAGRAM_BLOCKS.includes(b.id) ? ' • Rename updates the stage diagram label' : ''}`}
                        />
                        {b.name !== b.id && (
                          <span
                            className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border bg-indigo-50 border-indigo-100 text-indigo-700"
                            title={`Block ID: ${b.id}`}
                          >
                            {b.id}
                          </span>
                        )}
                      </div>

                      {/* Status (Online / Counter) */}
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-2xs ${
                            b.online
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'bg-amber-400 text-amber-950 border-amber-500'
                          }`}
                        >
                          {b.online ? <Monitor className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                          {b.online ? 'Online' : 'Counter'}
                        </span>
                      </div>

                      {/* Action (Switch ON / OFF) */}
                      <div className="flex justify-center">
                        <button
                          disabled={updatingId === b.id}
                          onClick={() =>
                            setPendingToggle({
                              id: b.id,
                              name: b.name,
                              targetMode: b.online ? 'counter' : 'online'
                            })
                          }
                          title={
                            updatingId === b.id
                              ? 'Saving to Supabase database...'
                              : b.online
                                ? 'Switch is ON (Online selling). Click to turn OFF (Counter).'
                                : 'Switch is OFF (Counter selling). Click to turn ON (Online).'
                          }
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors relative flex-shrink-0 focus:outline-none ${
                            updatingId === b.id ? 'opacity-70 cursor-wait' : ''
                          } ${
                            b.online ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform flex items-center justify-center ${
                              b.online ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          >
                            {updatingId === b.id && (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-600" />
                            )}
                          </span>
                        </button>
                      </div>

                      <div className="flex justify-center">
                        <button
                          onClick={() => removeBlock(b.id)}
                          disabled={b.builtin}
                          title={b.builtin ? 'Built-in block cannot be deleted' : 'Delete block'}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            b.builtin
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-400 hover:text-white hover:bg-rose-500'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400 flex-shrink-0 mt-auto">
              <span>{visible.length} of {blocks.length} block categories</span>
              <span className="text-emerald-600 font-extrabold">• Green = Online (ON)</span>
              <span className="text-amber-600 font-extrabold">• Yellow = Counter (OFF)</span>
              {noChannelWarn(stats)}
            </div>
          </div>
        </div>

        {/* Live diagram preview section */}
        <div className="flex flex-col h-full space-y-2">
          <div className="flex items-center gap-2 px-1 h-5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">Live Diagram Preview</h3>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">hover a row to highlight</span>
          </div>

          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-md p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
            <div className="w-full flex-1 flex items-center justify-center min-h-0 py-2">
              <StageDiagram
                labels={labels}
                channelLabels={channelLabels}
                seatStats={seatStats}
                disabledBlocks={disabledBlocks}
                activeBlock={activeBlock}
                gradientIdPrefix="diagramSettings"
                noBg
                className="w-full h-full max-h-[500px] flex items-center justify-center"
              />
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 flex flex-col items-center gap-1.5 flex-shrink-0 mt-auto">
              <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#d97706] inline-block shadow-xs" /> Counter</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#16a34a] inline-block shadow-xs" /> Online</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626] inline-block shadow-xs" /> All Booked</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 text-center">
                Green rows = Online active (Status ON) · Yellow rows = Counter selling (Status OFF)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Action Switch */}
      {pendingToggle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPendingToggle(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  pendingToggle.targetMode === 'online'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {pendingToggle.targetMode === 'online' ? (
                  <Monitor className="w-5 h-5" />
                ) : (
                  <Store className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900">
                  {pendingToggle.targetMode === 'online'
                    ? 'Switch to Online Selling?'
                    : 'Switch to Counter Selling?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  {pendingToggle.targetMode === 'online' ? (
                    <>
                      Are you sure you want to turn <b className="text-emerald-600 font-black">ON</b> online selling for{' '}
                      <span className="font-bold text-slate-800">“{pendingToggle.name}”</span>? Seats in this block will be open for online customer bookings immediately.
                    </>
                  ) : (
                    <>
                      Are you sure you want to turn <b className="text-amber-600 font-black">OFF</b> online selling for{' '}
                      <span className="font-bold text-slate-800">“{pendingToggle.name}”</span>? Seats in this block will be restricted to Counter box-office sales only.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingToggle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteToggle}
                className={`px-4 py-2 text-xs font-black text-white rounded-xl shadow-md transition-all active:scale-95 ${
                  pendingToggle.targetMode === 'online'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                }`}
              >
                {pendingToggle.targetMode === 'online' ? 'Turn ON (Online)' : 'Turn OFF (Counter)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function noChannelWarn(stats: { online: number; counter: number }) {
  if (stats.online === 0 || stats.counter === 0) {
    return <span className="text-rose-500">All blocks on a single channel</span>;
  }
  return null;
}
