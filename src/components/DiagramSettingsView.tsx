'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  RotateCcw,
  Monitor,
  Store,
  Check,
  Layers,
  AlertTriangle
} from 'lucide-react';
import StageDiagram, { buildSeatStats } from '@/components/StageDiagram';
import { BlockCategory, defaultBlockCategories } from '@/lib/blockCategories';
import { useBlockCategories } from '@/hooks/useBlockCategories';
import { Seat } from '@/types';

const DIAGRAM_BLOCKS = ['C2', 'A2', 'C3', 'C1', 'A1', 'A3', 'B1', 'B2', 'B3'];

export default function DiagramSettingsView({ seats = [] }: { seats?: Seat[] }) {
  const { blocks, setBlocks, labels, channelLabels, disabledBlocks } = useBlockCategories();
  const seatStats = useMemo(() => buildSeatStats(seats), [seats]);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const firstRender = useRef(true);

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

  /** Channel logic: status ON = counter selling, status OFF = online selling.
   *  Flushed to Firestore immediately so all apps update in real time. */
  const setMode = (id: string, mode: 'counter' | 'online') =>
    patch(
      id,
      mode === 'counter'
        ? { enabled: true, counter: true, online: false }
        : { enabled: false, counter: false, online: true },
      true
    );

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
      { id, name, enabled: true, online: false, counter: true, builtin: false }
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
    const counterMode = blocks.filter((b) => b.counter).length;
    const onlineMode = blocks.filter((b) => b.online).length;
    return {
      total: blocks.length,
      enabled: counterMode,
      disabled: onlineMode,
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
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Rename blocks and flip Status — <b className="text-amber-600">ON = Counter selling</b> (default),{' '}
            <b className="text-blue-600">OFF = active for Online selling</b>.
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
          >
            <Plus className="w-4 h-4" />
            Add Block Category
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
          { label: 'Counter Selling (Status ON)', value: stats.counter, cls: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: 'Online Active (Status OFF)', value: stats.online, cls: 'bg-blue-50 border-blue-200 text-blue-700' }
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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-start">
        {/* Block table (Excel-like rows) */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="grid grid-cols-[40px_70px_1fr_84px_92px_74px_44px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>#</span>
            <span>ID</span>
            <span>Block Name</span>
            <span className="text-center">Online</span>
            <span className="text-center">Counter</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs font-bold text-slate-400">
              No block categories match “{query}”.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((b, i) => {
                return (
                  <div
                    key={b.id}
                    onMouseEnter={() => setActiveBlock(b.id)}
                    onMouseLeave={() => setActiveBlock(null)}
                    className={`grid grid-cols-[40px_70px_1fr_84px_92px_74px_44px] gap-2 items-center px-4 py-2 transition-colors ${
                      activeBlock === b.id
                        ? 'bg-indigo-50/60'
                        : b.enabled
                          ? 'bg-amber-50/40 hover:bg-amber-50/80'
                          : 'bg-blue-50/40 hover:bg-blue-50/80'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>

                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5 w-fit">
                      {b.id}
                    </span>

                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        value={b.name}
                        onChange={(e) => patch(b.id, { name: e.target.value })}
                        className="min-w-0 flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-800 transition-all"
                        title={DIAGRAM_BLOCKS.includes(b.id) ? 'Rename updates the stage diagram label' : 'Block display name'}
                      />
                      <span
                        className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          b.counter
                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                            : 'bg-blue-100 border-blue-200 text-blue-700'
                        }`}
                      >
                        {b.counter ? 'Counter' : 'Online'}
                      </span>
                    </div>

                    <div className="flex justify-center">
                      <ChannelToggle
                        active={b.online}
                        onClick={() => setMode(b.id, 'online')}
                        title="Switch to Online selling (Status OFF)"
                        activeCls="bg-blue-600 text-white border-blue-600"
                        icon={<Monitor className="w-3 h-3" />}
                        label="Online"
                      />
                    </div>

                    <div className="flex justify-center">
                      <ChannelToggle
                        active={b.counter}
                        onClick={() => setMode(b.id, 'counter')}
                        title="Switch to Counter selling (Status ON)"
                        activeCls="bg-amber-500 text-white border-amber-500"
                        icon={<Store className="w-3 h-3" />}
                        label="Counter"
                      />
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => setMode(b.id, b.enabled ? 'online' : 'counter')}
                        title={
                          b.enabled
                            ? 'Status ON — selling at counter. Click to go Online.'
                            : 'Status OFF — active for online selling. Click to go Counter.'
                        }
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors relative ${
                          b.enabled ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            b.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => removeBlock(b.id)}
                        disabled={b.builtin}
                        title={b.builtin ? 'Built-in block cannot be deleted' : 'Delete block'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          b.builtin
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-white hover:bg-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400">
            <span>{visible.length} of {blocks.length} block categories</span>
            <span className="text-amber-600">Amber = Counter selling (Status ON)</span>
            <span className="text-blue-600">Blue = Online active (Status OFF)</span>
            {noChannelWarn(stats)}
          </div>
        </div>

        {/* Live diagram preview */}
        <div className="xl:sticky xl:top-24 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">Live Diagram Preview</h3>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">hover a row to highlight</span>
          </div>
          <StageDiagram
            labels={labels}
            channelLabels={channelLabels}
            seatStats={seatStats}
            disabledBlocks={disabledBlocks}
            activeBlock={activeBlock}
            gradientIdPrefix="diagramSettings"
            className="max-w-[560px] mx-auto"
          />
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#d97706] inline-block" /> Counter</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#16a34a] inline-block" /> Online</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#dc2626] inline-block" /> All Booked</span>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 text-center">
            Amber rows = Counter selling (Status ON) · Blue rows = Online active (Status OFF).
          </p>
        </div>
      </div>
    </div>
  );
}

function noChannelWarn(stats: { online: number; counter: number }) {
  if (stats.online === 0 || stats.counter === 0) {
    return <span className="text-rose-500">All blocks on a single channel</span>;
  }
  return null;
}

function ChannelToggle({
  active,
  onClick,
  title,
  activeCls,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  activeCls: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black transition-all ${
        active
          ? activeCls
          : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'
      }`}
    >
      {active ? <Check className="w-3 h-3" /> : icon}
      {label}
    </button>
  );
}
