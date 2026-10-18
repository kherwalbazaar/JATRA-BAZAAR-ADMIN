'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Theater,
  Search,
  Plus,
  Edit3,
  Trash2,
  MapPin,
  Phone,
  Calendar,
  Sparkles,
  CheckCircle2,
  X,
  AlertTriangle,
  Radio,
  User,
  PenTool,
  MoreVertical,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { PartyItem, EventItem } from '@/types';
import {
  computeParties,
  addOrUpdateParty,
  deleteLocalParty,
} from '@/lib/parties';

interface PartiesViewProps {
  events: EventItem[];
  onSelectEvent?: (event: EventItem) => void;
  onNavigateToEvents?: () => void;
}

function getContactNumbers(party: PartyItem): string[] {
  const list: string[] = [];
  if (party.phone) {
    if (party.phone.includes(',') || party.phone.includes('/')) {
      list.push(...party.phone.split(/[,/]/).map((s) => s.trim()).filter(Boolean));
    } else {
      list.push(party.phone.trim());
    }
  }
  if (party.phone2) {
    if (party.phone2.includes(',') || party.phone2.includes('/')) {
      list.push(...party.phone2.split(/[,/]/).map((s) => s.trim()).filter(Boolean));
    } else {
      list.push(party.phone2.trim());
    }
  }
  return Array.from(new Set(list));
}

export default function PartiesView({
  events = [],
  onSelectEvent,
  onNavigateToEvents,
}: PartiesViewProps) {
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute combined parties list
  const parties = useMemo(() => {
    // refreshKey is used to re-trigger memo when local storage updates
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshKey;
    return computeParties(events);
  }, [events, refreshKey]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyItem | null>(null);
  const [viewTarget, setViewTarget] = useState<PartyItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuId(null);
    if (openMenuId) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [openMenuId]);

  // Unique directors collected dynamically from real events and configured parties
  const directorOptions = useMemo(() => {
    const EXCLUDED = new Set([
      'Bishwanath Tudu', 'Rabi Soren', 'Suklal Besra', 'Purnachandra Marndi',
      'Somenath Hansdah', 'Dukhia Soren', 'Ramraj Natya Mandir',
      'Balakram Tudu', 'Dr. K.C. Tudu', 'Bijay Marndi',
      'Raju Hembram', 'Damodar Majhi', 'Ratan Soren', 'Shyam Charan Besra'
    ]);
    const set = new Set<string>();

    // 1. Collect from real events
    events.forEach((e) => {
      if (e.director?.trim()) set.add(e.director.trim());
      const raw = (e as unknown as Record<string, unknown>).director as string;
      if (raw?.trim()) set.add(raw.trim());
      const credits = (e as unknown as Record<string, unknown>).credits as Record<string, unknown> | undefined;
      if (credits?.director && typeof credits.director === 'string' && credits.director.trim()) {
        set.add(credits.director.trim());
      }
    });

    // 2. Collect from configured troupe parties
    parties.forEach((p) => {
      if (p.director?.trim()) set.add(p.director.trim());
    });

    // 3. Fallback to real defaults if no events loaded yet
    if (set.size === 0) {
      set.add('Dasarath Sing');
      set.add('Dasarath Singh');
    }

    return Array.from(set).filter((name) => Boolean(name) && !EXCLUDED.has(name)).sort();
  }, [events, parties]);

  // Unique writers collected dynamically from real events and configured parties
  const writerOptions = useMemo(() => {
    const EXCLUDED = new Set([
      'Bishwanath Tudu', 'Rabi Soren', 'Suklal Besra', 'Purnachandra Marndi',
      'Somenath Hansdah', 'Dukhia Soren', 'Ramraj Natya Mandir',
      'Balakram Tudu', 'Dr. K.C. Tudu', 'Bijay Marndi',
      'Raju Hembram', 'Damodar Majhi', 'Ratan Soren', 'Shyam Charan Besra'
    ]);
    const set = new Set<string>();

    // 1. Collect from real events
    events.forEach((e) => {
      if (e.writer?.trim()) set.add(e.writer.trim());
      const raw = (e as unknown as Record<string, unknown>).writer as string;
      if (raw?.trim()) set.add(raw.trim());
      const credits = (e as unknown as Record<string, unknown>).credits as Record<string, unknown> | undefined;
      if (credits?.writer && typeof credits.writer === 'string' && credits.writer.trim()) {
        set.add(credits.writer.trim());
      }
    });

    // 2. Collect from configured troupe parties
    parties.forEach((p) => {
      if (p.writer?.trim()) set.add(p.writer.trim());
    });

    // 3. Fallback to real defaults if no events loaded yet
    if (set.size === 0) {
      set.add('Maheswar Soren');
      set.add('Kanhu Marndi');
    }

    return Array.from(set).filter((name) => Boolean(name) && !EXCLUDED.has(name)).sort();
  }, [events, parties]);

  const [customDirector, setCustomDirector] = useState(false);
  const [customWriter, setCustomWriter] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<PartyItem>>({
    name: '',
    logo: '',
    genre: '',
    location: '',
    director: '',
    writer: '',
    phone: '',
    phone2: '',
    status: 'active',
  });

  const handleOpenAdd = () => {
    setEditingParty(null);
    setCustomDirector(false);
    setCustomWriter(false);
    setFormData({
      id: `party-${Date.now()}`,
      name: '',
      logo: '',
      genre: 'Santali Cultural Opera',
      location: 'Mayurbhanj, Odisha',
      director: '',
      writer: '',
      phone: '',
      phone2: '',
      status: 'active',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (party: PartyItem) => {
    setEditingParty(party);
    setCustomDirector(party.director ? !directorOptions.includes(party.director) : false);
    setCustomWriter(party.writer ? !writerOptions.includes(party.writer) : false);
    let p1 = party.phone || '';
    let p2 = party.phone2 || '';
    if (!p2 && (p1.includes(',') || p1.includes('/'))) {
      const parts = p1.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
      p1 = parts[0] || '';
      p2 = parts.slice(1).join(' / ') || '';
    }
    setFormData({
      ...party,
      director: party.director || '',
      writer: party.writer || '',
      phone: p1,
      phone2: p2,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const partyToSave: PartyItem = {
      id: editingParty?.id || formData.id || `party-${Date.now()}`,
      name: formData.name.trim(),
      logo: formData.logo?.trim() || '',
      genre: formData.genre?.trim() || 'Jatra Opera Troupe',
      location: formData.location?.trim() || 'Odisha',
      director: formData.director?.trim() || '',
      writer: formData.writer?.trim() || '',
      phone: formData.phone?.trim() || '',
      phone2: formData.phone2?.trim() || '',
      status: formData.status || 'active',
      activeShows: editingParty?.activeShows || 0,
      color: editingParty?.color || 'from-indigo-500 to-purple-600',
    };

    addOrUpdateParty(partyToSave);
    setRefreshKey((k) => k + 1);
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteLocalParty(deleteTarget.id);
    setRefreshKey((k) => k + 1);
    setDeleteTarget(null);
  };

  // Filtered list
  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.director && p.director.toLowerCase().includes(q)) ||
      (p.writer && p.writer.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.phone2 && p.phone2.toLowerCase().includes(q))
    );
  }, [parties, search]);

  const totalActiveShows = useMemo(() => {
    return parties.reduce((sum, p) => sum + (p.activeShows || 0), 0);
  }, [parties]);

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Theater className="w-4 h-4" />
            </div>
            <span>Opera Parties Directory</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">
              {parties.length} {parties.length === 1 ? 'Troupe' : 'Troupes'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Manage jatra opera parties, logos, active show associations, director details, and stage locations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Party</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Troupes</div>
          <div className="text-xl font-black text-slate-900 mt-1">{parties.length}</div>
          <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Configured in System</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Stage Shows</div>
          <div className="text-xl font-black text-indigo-600 mt-1">{totalActiveShows}</div>
          <div className="text-[10px] font-semibold text-indigo-600/80 mt-0.5">Live in Event Schedule</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Featured Brands</div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {parties.filter((p) => (p.activeShows || 0) > 0).length}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Troupes with Active Runs</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer App View</div>
          <div className="text-xl font-black text-emerald-600 mt-1">Visible</div>
          <div className="text-[10px] font-semibold text-emerald-600/80 mt-0.5">Home &amp; /parties page</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party name, location, genre..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-slate-500 self-end sm:self-auto">
          Showing <span className="text-slate-900 font-extrabold">{filteredParties.length}</span> of {parties.length}
        </div>
      </div>

      {/* Grid of Cards */}
      {filteredParties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200/80">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Theater className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">No Opera Parties Found</h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-5">
            {search
              ? `No parties matching "${search}". Try searching for another name or location.`
              : 'Get started by creating your first opera troupe in the directory.'}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Party
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
          {filteredParties.map((party) => {
            const hasShows = (party.activeShows || 0) > 0;
            return (
              <div
                key={party.id}
                className="group bg-white rounded-3xl border border-slate-200/90 hover:border-indigo-400/80 shadow-xs hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Card Top Accent Bar with Badges */}
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

                <div className="p-5 flex-1 flex flex-col justify-between">
                  {/* Top section: Avatar & Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Logo / Avatar */}
                      <div className="relative">
                        <div className="w-20 aspect-[5/3] rounded-lg overflow-hidden bg-slate-900 border-2 border-slate-100 shadow-md flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          {party.logo ? (
                            <img
                              src={party.logo}
                              alt=""
                              aria-hidden="true"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-slate-400 font-black text-sm uppercase -z-10 bg-slate-900 select-none">
                            {party.name.substring(0, 2)}
                          </div>
                        </div>

                        {hasShows && (
                          <span
                            title="Active Stage Shows"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                          />
                        )}
                      </div>

                      {/* Top Right: Active Shows Badge & 3-Dot Menu */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            hasShows
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Radio
                            className={`w-2.5 h-2.5 ${
                              hasShows ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
                            }`}
                          />
                          {party.activeShows || 0} {(party.activeShows || 0) === 1 ? 'Show' : 'Shows'}
                        </span>

                        {/* 3-Dot Menu Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === party.id ? null : party.id);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* 3-Dot Dropdown with View and Edit */}
                          {openMenuId === party.id && (
                            <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setViewTarget(party);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleOpenEdit(party);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setDeleteTarget(party);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Party Name & Genre */}
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900 leading-snug tracking-tight group-hover:text-indigo-600 transition-colors">
                        {party.name}
                      </h3>
                      <div className="mt-2 inline-block px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        {party.genre || 'Jatra Opera Troupe'}
                      </div>
                    </div>

                    {/* Meta info list */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{party.location || 'Odisha'}</span>
                      </div>

                      {party.director && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            <span className="text-slate-400 font-medium mr-1">Director:</span>
                            <span className="text-slate-700 font-bold">{party.director}</span>
                          </span>
                        </div>
                      )}

                      {party.writer && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <PenTool className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            <span className="text-slate-400 font-medium mr-1">Writer:</span>
                            <span className="text-slate-700 font-bold">{party.writer}</span>
                          </span>
                        </div>
                      )}

                      {(() => {
                        const contactNumbers = getContactNumbers(party);
                        if (contactNumbers.length === 0) return null;
                        return (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                              {contactNumbers.map((num, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && <span className="text-slate-300 font-sans">/</span>}
                                  <span className="truncate">{num}</span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Party Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Theater className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingParty ? 'Edit Opera Party' : 'Add New Opera Party'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. ADIM OWAR JARPA OPERA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party Logo / Banner URL
                </label>
                <input
                  type="url"
                  value={formData.logo || ''}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  placeholder="https://example.com/logo.jpg"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {formData.logo && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={formData.logo}
                      alt="Preview"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="text-[11px] text-slate-400 font-medium">Logo Preview</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party Address
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Bahanada, Mayurbhanj, Odisha"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Director Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Director
                  </label>
                  <select
                    value={
                      customDirector
                        ? '__custom__'
                        : directorOptions.includes(formData.director || '')
                        ? formData.director
                        : formData.director
                        ? '__custom__'
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setCustomDirector(true);
                        setFormData((prev) => ({ ...prev, director: '' }));
                      } else {
                        setCustomDirector(false);
                        setFormData((prev) => ({ ...prev, director: val }));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Director</option>
                    {directorOptions.map((dir) => (
                      <option key={dir} value={dir}>
                        {dir}
                      </option>
                    ))}
                    <option value="__custom__">+ Add New Director (Type)</option>
                  </select>

                  {(customDirector || (formData.director && !directorOptions.includes(formData.director))) && (
                    <input
                      type="text"
                      autoFocus={customDirector}
                      value={formData.director || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, director: e.target.value }))}
                      placeholder="Type director name..."
                      className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 mt-2 bg-indigo-50/30"
                    />
                  )}
                </div>

                {/* Writer Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Writer
                  </label>
                  <select
                    value={
                      customWriter
                        ? '__custom__'
                        : writerOptions.includes(formData.writer || '')
                        ? formData.writer
                        : formData.writer
                        ? '__custom__'
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setCustomWriter(true);
                        setFormData((prev) => ({ ...prev, writer: '' }));
                      } else {
                        setCustomWriter(false);
                        setFormData((prev) => ({ ...prev, writer: val }));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Writer</option>
                    {writerOptions.map((wr) => (
                      <option key={wr} value={wr}>
                        {wr}
                      </option>
                    ))}
                    <option value="__custom__">+ Add New Writer (Type)</option>
                  </select>

                  {(customWriter || (formData.writer && !writerOptions.includes(formData.writer))) && (
                    <input
                      type="text"
                      autoFocus={customWriter}
                      value={formData.writer || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, writer: e.target.value }))}
                      placeholder="Type writer name..."
                      className="w-full px-3.5 py-2 rounded-xl border border-purple-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500 mt-2 bg-purple-50/30"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact 1
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 94371 23456"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact 2
                  </label>
                  <input
                    type="text"
                    value={formData.phone2 || ''}
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                >
                  {editingParty ? 'Update Party' : 'Create Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Opera Party?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteTarget.name}"</span>? This will remove custom troupe records.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Party Details Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header Bar */}
            <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Theater className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Opera Party Details
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Troupe Directory Profile
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Banner / Logo & Name */}
              <div className="flex items-start gap-4">
                <div className="w-24 aspect-[5/3] rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-100 shadow-md flex items-center justify-center flex-shrink-0">
                  {viewTarget.logo ? (
                    <img
                      src={viewTarget.logo}
                      alt={viewTarget.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="text-slate-400 font-black text-base uppercase bg-slate-900 select-none">
                    {viewTarget.name.substring(0, 2)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    {viewTarget.name}
                  </h2>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                    {viewTarget.genre || 'Santali Cultural Opera'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                      {viewTarget.activeShows || 0} {(viewTarget.activeShows || 0) === 1 ? 'Active Show' : 'Active Shows'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details List */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                {/* Party Address */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Party Address</span>
                    <span className="font-semibold text-slate-800">{viewTarget.location || 'Odisha'}</span>
                  </div>
                </div>

                {/* Director */}
                {viewTarget.director && (
                  <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-200/60">
                    <User className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Director</span>
                      <span className="font-bold text-slate-800">{viewTarget.director}</span>
                    </div>
                  </div>
                )}

                {/* Writer */}
                {viewTarget.writer && (
                  <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-200/60">
                    <PenTool className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Writer</span>
                      <span className="font-bold text-slate-800">{viewTarget.writer}</span>
                    </div>
                  </div>
                )}

                {/* Contact Numbers */}
                {(() => {
                  const numbers = getContactNumbers(viewTarget);
                  if (numbers.length === 0) return null;
                  return (
                    <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-200/60">
                      <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {numbers.map((num, i) => (
                            <span key={i} className="font-mono font-bold text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-800">
                              {num}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Associated Active Events */}
              {(() => {
                const partyEvents = events.filter((ev) => {
                  const evParty = String(ev.partyName || (ev as unknown as Record<string, unknown>).party_name || '').trim().toUpperCase();
                  return evParty && evParty === viewTarget.name.toUpperCase();
                });

                if (partyEvents.length === 0) return null;

                return (
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Active Stage Schedule ({partyEvents.length})
                    </h4>
                    <div className="space-y-2">
                      {partyEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-black text-slate-900 truncate">{ev.title}</h5>
                            <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                              📅 {ev.date} ({ev.day}) • 📍 {ev.venue || ev.address || 'Venue TBD'}
                            </p>
                          </div>
                          {onSelectEvent && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectEvent(ev);
                                setViewTarget(null);
                                if (onNavigateToEvents) onNavigateToEvents();
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex-shrink-0"
                            >
                              Open Show
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewTarget;
                  setViewTarget(null);
                  handleOpenEdit(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Party</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
