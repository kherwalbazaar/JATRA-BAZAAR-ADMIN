'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Link2, FileText, Check } from 'lucide-react';
import { EventItem, EventActor } from '@/types';
import { getEventsOnce } from '@/lib/firestore';

interface EventFormProps {
  initial?: Partial<EventItem> | null;
  submitting?: boolean;
  submitLabel?: string;
  enableDraft?: boolean;
  onSubmit: (data: Omit<EventItem, 'id'>) => Promise<void> | void;
  onCancel: () => void;
}

const DRAFT_KEY = 'jatra_event_draft';
const NEW_OPTION = '__new__';

const AUDIENCE_OPTIONS = [
  'All Ages',
  'Family',
  'Kids (Below 12)',
  'Teenagers (13-17)',
  'Adults (18+)',
  'Senior Citizens (60+)',
  'Students',
  'General',
];

// Time options at 30-minute intervals (12-hour format)
const TIME_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += 30) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    list.push(`${h12}:${m === 0 ? '00' : '30'} ${ampm}`);
  }
  return list;
})();

function parseTime12(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

function computeDuration(start?: string, end?: string): string {
  const s = start ? parseTime12(start) : null;
  const e = end ? parseTime12(end) : null;
  if (s === null || e === null) return '';
  let diff = e - s;
  if (diff <= 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h && m) return `${h} Hour${h > 1 ? 's' : ''} ${m} Minute${m > 1 ? 's' : ''}`;
  if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
  return `${m} Minute${m > 1 ? 's' : ''}`;
}

// Coerce legacy free-text times (incl. "08:30 PM - 04:30 AM" ranges) into a select option
function coerceTime(v: string | undefined, which: 'first' | 'last' = 'first'): string {
  if (!v) return '';
  if (TIME_OPTIONS.includes(v)) return v;
  const parts = v.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  const cand = which === 'first' ? parts[0] : parts[parts.length - 1];
  return cand && TIME_OPTIONS.includes(cand) ? cand : '';
}

function readDraft(): Partial<EventItem> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<EventItem>) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  { value: 'Jan', label: 'January' },
  { value: 'Feb', label: 'February' },
  { value: 'Mar', label: 'March' },
  { value: 'Apr', label: 'April' },
  { value: 'May', label: 'May' },
  { value: 'Jun', label: 'June' },
  { value: 'Jul', label: 'July' },
  { value: 'Aug', label: 'August' },
  { value: 'Sep', label: 'September' },
  { value: 'Oct', label: 'October' },
  { value: 'Nov', label: 'November' },
  { value: 'Dec', label: 'December' },
];

function parseLegacyDate(dateStr?: string, dayStr?: string) {
  let year = '';
  let month = '';
  let dayOfMonth = '';
  if (dateStr) {
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
      dayOfMonth = parts[0];
      const m = MONTHS.find((mo) => mo.value.toLowerCase() === parts[1].toLowerCase() || mo.label.toLowerCase() === parts[1].toLowerCase());
      month = m ? m.value : '';
      year = parts[2];
    }
  }
  return { year, month, dayOfMonth, weekday: dayStr || '' };
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-3 first:pt-0">
      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center flex-shrink-0">
        {n}
      </span>
      <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h2>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition';
const labelCls = 'text-[11px] font-black uppercase text-slate-500 block mb-1.5';

export default function EventForm({ initial, submitting, submitLabel, enableDraft, onSubmit, onCancel }: EventFormProps) {
  // Boot source: saved draft (create page only) takes priority over initial data
  const [boot] = useState(() => {
    if (enableDraft) {
      const draft = readDraft();
      if (draft) return { src: draft as Partial<EventItem>, fromDraft: true };
    }
    return { src: (initial ?? null) as Partial<EventItem> | null, fromDraft: false };
  });
  const src = boot.src;
  const legacy = parseLegacyDate(src?.date, src?.day);

  const [draftRestored, setDraftRestored] = useState(boot.fromDraft);
  const [draftSaved, setDraftSaved] = useState(false);

  const [saleMode, setSaleMode] = useState<EventItem['saleMode']>(src?.saleMode || 'Counter');
  const [title, setTitle] = useState(src?.title || '');
  const [eventTitle, setEventTitle] = useState(src?.eventTitle || '');
  const [committeeName, setCommitteeName] = useState(src?.committeeName || '');
  const [committeeLocation, setCommitteeLocation] = useState(src?.committeeLocation || '');
  const [partyName, setPartyName] = useState(src?.partyName || '');
  const [language, setLanguage] = useState(src?.language || 'Santali');
  const [audience, setAudience] = useState(src?.audience || '');
  const [year, setYear] = useState(src?.year || legacy.year);
  const [month, setMonth] = useState(src?.month || legacy.month);
  const [dayOfMonth, setDayOfMonth] = useState(src?.dayOfMonth || legacy.dayOfMonth);
  const [about, setAbout] = useState(src?.description || '');

  const currentYear = new Date().getFullYear();
  const yearOptions = (() => {
    const list: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 6; y++) list.push(y);
    if (year && !list.includes(Number(year))) list.push(Number(year));
    return list.sort((a, b) => a - b);
  })();

  const [entryTime, setEntryTime] = useState(coerceTime(src?.entryTime));
  const [startTime, setStartTime] = useState(coerceTime(src?.startTime) || coerceTime(src?.time, 'first'));
  const [endTime, setEndTime] = useState(coerceTime(src?.endTime, 'last') || coerceTime(src?.eventTime, 'last') || coerceTime(src?.time, 'last'));
  const duration = computeDuration(startTime, endTime) || src?.duration || '';

  const [address, setAddress] = useState(src?.address || src?.venue || '');
  const [phone, setPhone] = useState(src?.phone || '');

  const [actors, setActors] = useState<EventActor[]>(src?.actors?.length ? src.actors : [{ name: '', photo: '' }]);
  const [mainBanner, setMainBanner] = useState(src?.poster || '');
  const [additionalBanners, setAdditionalBanners] = useState<string[]>(src?.additionalBanners?.length ? src.additionalBanners : ['']);

  const [writer, setWriter] = useState(src?.writer || '');
  const [director, setDirector] = useState(src?.director || '');
  const [musicDirector, setMusicDirector] = useState(src?.musicDirector || '');
  const [singer, setSinger] = useState(src?.singer || '');
  const [trailerUrl, setTrailerUrl] = useState(src?.trailerUrl || '');

  const updateActor = (i: number, key: keyof EventActor, value: string) => {
    setActors((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  };

  // ── Party / Story dropdown data (loaded from Firestore events) ──
  const eventsRef = useRef<EventItem[]>([]);
  const [partyOptions, setPartyOptions] = useState<string[]>([]);
  const [storyOptions, setStoryOptions] = useState<string[]>([]);

  const buildStoryOptions = (party: string, keepTitle?: string) => {
    const evts = eventsRef.current;
    const names = Array.from(
      new Set(
        evts
          .filter((e) => !party || party === NEW_OPTION || (e.partyName || '').trim() === party)
          .map((e) => (e.title || '').trim())
          .filter(Boolean)
      )
    );
    if (keepTitle && keepTitle !== NEW_OPTION && !names.includes(keepTitle)) names.push(keepTitle);
    names.sort();
    setStoryOptions(names);
  };

  useEffect(() => {
    let cancelled = false;
    getEventsOnce()
      .then((evts) => {
        if (cancelled) return;
        eventsRef.current = evts;
        const parties = Array.from(new Set(evts.map((e) => (e.partyName || '').trim()).filter(Boolean))).sort();
        const currentParty = (src?.partyName || '').trim();
        if (currentParty && !parties.includes(currentParty)) parties.push(currentParty);
        setPartyOptions(parties);
        buildStoryOptions(currentParty, (src?.title || '').trim());
      })
      .catch((err) => console.warn('Failed to load party/story lists:', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keepIfSet = (current: string, next?: string) => (next && next.trim() ? next.trim() : current);

  // Selecting a party → auto-fill party defaults (story name, date & times stay untouched)
  const handlePartyChange = (value: string) => {
    if (value === NEW_OPTION) {
      setPartyName(NEW_OPTION);
      setStoryOptions([]);
      return;
    }
    setPartyName(value);
    buildStoryOptions(value);
    const match = eventsRef.current.find((e) => (e.partyName || '').trim() === value);
    if (!match) return;
    setCommitteeName((c) => keepIfSet(c, match.committeeName));
    setCommitteeLocation((c) => keepIfSet(c, match.committeeLocation));
    setEventTitle((v) => keepIfSet(v, match.eventTitle));
    setLanguage((v) => (match.language?.trim() ? match.language.trim() : v));
    setAudience((v) => {
      if (!match.audience?.trim()) return v;
      return AUDIENCE_OPTIONS.includes(match.audience) ? match.audience : match.audience;
    });
    setSaleMode((v) => (match.saleMode ? match.saleMode : v));
    setAddress((v) => keepIfSet(v, match.address || match.venue));
    setPhone((v) => keepIfSet(v, match.phone));
    setWriter((v) => keepIfSet(v, match.writer));
    setDirector((v) => keepIfSet(v, match.director));
    setMusicDirector((v) => keepIfSet(v, match.musicDirector));
    setSinger((v) => keepIfSet(v, match.singer));
    setTrailerUrl((v) => keepIfSet(v, match.trailerUrl));
    setActors((prev) => (match.actors?.length ? match.actors : prev));
    setMainBanner((v) => keepIfSet(v, match.poster));
    setAdditionalBanners((prev) => (match.additionalBanners?.length ? match.additionalBanners : prev));
    // Story Name, About, Event Date & Times are intentionally NOT filled —
    // required per-show data (like date) must be entered fresh.
  };

  // Selecting a story (as per party) → auto-fill that story's data (date & times stay untouched)
  const handleStoryChange = (value: string) => {
    if (value === NEW_OPTION) {
      setTitle(NEW_OPTION);
      return;
    }
    setTitle(value);
    const party = partyName !== NEW_OPTION ? partyName.trim() : '';
    const match =
      eventsRef.current.find(
        (e) => (e.title || '').trim() === value && (!party || (e.partyName || '').trim() === party)
      ) || eventsRef.current.find((e) => (e.title || '').trim() === value);
    if (!match) return;
    setEventTitle((v) => keepIfSet(v, match.eventTitle));
    setAbout((v) => keepIfSet(v, match.description));
    setWriter((v) => keepIfSet(v, match.writer));
    setDirector((v) => keepIfSet(v, match.director));
    setMusicDirector((v) => keepIfSet(v, match.musicDirector));
    setSinger((v) => keepIfSet(v, match.singer));
    setTrailerUrl((v) => keepIfSet(v, match.trailerUrl));
    setActors((prev) => (match.actors?.length ? match.actors : prev));
    setMainBanner((v) => keepIfSet(v, match.poster));
    setAdditionalBanners((prev) => (match.additionalBanners?.length ? match.additionalBanners : prev));
    setCommitteeName((c) => keepIfSet(c, match.committeeName));
    setCommitteeLocation((c) => keepIfSet(c, match.committeeLocation));
    setAddress((v) => keepIfSet(v, match.address || match.venue));
    setPhone((v) => keepIfSet(v, match.phone));
    // Event Date & Times are intentionally NOT filled — must be entered fresh.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title === NEW_OPTION ? '' : title.trim();
    const cleanParty = partyName === NEW_OPTION ? '' : partyName.trim();
    if (!cleanTitle || !eventTitle.trim() || !address.trim() || !year || !month || !dayOfMonth) {
      alert('Please fill required fields: Story Name, Event Title, Address, Year, Month, Day');
      return;
    }

    const y = Number(year);
    const m = MONTHS.findIndex((mo) => mo.value === month);
    const d = Number(dayOfMonth);
    const weekday = m >= 0 && y >= 1900 && d >= 1 ? DAY_NAMES[new Date(y, m, d).getDay()] : (initial?.day || '');
    const dateStr = `${d} ${month} ${y}`;
    const cleanTime = startTime && endTime ? `${startTime} - ${endTime}` : endTime || startTime || entryTime;

    const payload: Omit<EventItem, 'id'> = {
      title: cleanTitle.toUpperCase(),
      subtitle: initial?.subtitle || '',
      date: dateStr,
      day: weekday,
      time: cleanTime,
      venue: address.trim(),
      city: initial?.city || '',
      status: initial?.status || 'upcoming',
      saleMode,
      poster: mainBanner.trim(),
      totalCapacity: initial?.totalCapacity || 0,
      ticketsSold: initial?.ticketsSold || 0,
      totalRevenue: initial?.totalRevenue || 0,
      organizer: initial?.organizer || '',
      eventTitle: eventTitle.trim(),
      description: about.trim(),

      committeeName: committeeName.trim(),
      committeeLocation: committeeLocation.trim(),
      partyName: cleanParty,
      language: language.trim(),
      audience: audience === 'Other' ? '' : audience.trim(),
      year: String(y),
      month,
      dayOfMonth: String(d),

      entryTime: entryTime.trim(),
      startTime: startTime.trim(),
      eventTime: endTime.trim(),
      endTime: endTime.trim(),
      duration: duration.trim(),

      address: address.trim(),
      phone: phone.trim(),

      actors: actors.filter((a) => a.name.trim() || a.photo.trim()).map((a) => ({ name: a.name.trim(), photo: a.photo.trim() })),
      additionalBanners: additionalBanners.map((b) => b.trim()).filter(Boolean),

      writer: writer.trim(),
      director: director.trim(),
      musicDirector: musicDirector.trim(),
      singer: singer.trim(),

      trailerUrl: trailerUrl.trim(),
    };

    await onSubmit(payload);
    if (enableDraft) clearDraft();
  };

  const handleSaveDraft = () => {
    const draft: Partial<EventItem> = {
      saleMode,
      title,
      eventTitle,
      committeeName,
      committeeLocation,
      partyName,
      language,
      audience,
      year,
      month,
      dayOfMonth,
      description: about,
      entryTime,
      startTime,
      eventTime: endTime,
      endTime,
      duration,
      address,
      phone,
      actors: actors.filter((a) => a.name.trim() || a.photo.trim()),
      poster: mainBanner,
      additionalBanners: additionalBanners.map((b) => b.trim()).filter(Boolean),
      writer,
      director,
      musicDirector,
      singer,
      trailerUrl,
      date: year && month && dayOfMonth ? `${Number(dayOfMonth)} ${month} ${year}` : '',
      day: '',
      time: startTime && endTime ? `${startTime} - ${endTime}` : endTime || startTime || entryTime,
      city: '',
      totalCapacity: 0,
      ticketsSold: 0,
      totalRevenue: 0,
      subtitle: '',
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSaved(true);
      setDraftRestored(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch {
      alert('Failed to save draft to local storage.');
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    window.location.reload();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Draft restored notice */}
      {enableDraft && draftRestored && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-xs font-bold">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 flex-shrink-0" />
            {draftSaved ? 'Draft saved to local storage' : 'Draft restored from local storage'}
          </span>
          <div className="flex items-center gap-3">
            {draftSaved && <Check className="w-4 h-4 text-emerald-600" />}
            <button type="button" onClick={handleDiscardDraft} className="underline hover:text-amber-950 font-black">
              Discard draft
            </button>
          </div>
        </div>
      )}

      {/* 1. Event Details */}
      <SectionHeader n={1} title="Event Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Committee Name</label>
          <input type="text" value={committeeName} onChange={(e) => setCommitteeName(e.target.value)} placeholder="e.g. Jatra Bazaar Committee" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Committee Location</label>
          <input type="text" value={committeeLocation} onChange={(e) => setCommitteeLocation(e.target.value)} placeholder="e.g. Khunta, Mayurbhanj, Odisha" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Party Name</label>
          <select
            value={partyOptions.includes(partyName) ? partyName : partyName ? NEW_OPTION : ''}
            onChange={(e) => handlePartyChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Select party</option>
            {partyOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={NEW_OPTION}>New party (type below)</option>
          </select>
          {(partyName === NEW_OPTION || (partyName && !partyOptions.includes(partyName))) ? (
            <input
              type="text"
              value={partyName === NEW_OPTION ? '' : partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g. ADIM OWAR JARPA OPERA"
              className={`${inputCls} mt-2`}
            />
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Story Name *</label>
          <select
            required
            value={storyOptions.includes(title) ? title : title ? NEW_OPTION : ''}
            onChange={(e) => handleStoryChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Select story</option>
            {storyOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value={NEW_OPTION}>New story (type below)</option>
          </select>
          {(title === NEW_OPTION || (title && !storyOptions.includes(title))) ? (
            <input
              type="text"
              value={title === NEW_OPTION ? '' : title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Okoy Hirla rechom Bagiyanj Kan"
              className={`${inputCls} mt-2`}
            />
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Event Title *</label>
          <input type="text" required value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. PARBON PATA" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
            <option value="Santali">Santali</option>
            <option value="Odia">Odia</option>
            <option value="Hindi">Hindi</option>
            <option value="Bengali">Bengali</option>
            <option value="English">English</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Audience</label>
          <select
            value={AUDIENCE_OPTIONS.includes(audience) || audience === 'Other' ? audience : audience ? 'Other' : ''}
            onChange={(e) => setAudience(e.target.value)}
            className={inputCls}
          >
            <option value="">Select audience</option>
            {AUDIENCE_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="Other">Other (type below)</option>
          </select>
          {audience === 'Other' || (audience !== '' && !AUDIENCE_OPTIONS.includes(audience)) ? (
            <input
              type="text"
              value={audience === 'Other' ? '' : audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. All Community Members"
              className={`${inputCls} mt-2`}
            />
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Ticket Selling *</label>
          <select
            required
            value={saleMode}
            onChange={(e) => setSaleMode(e.target.value as EventItem['saleMode'])}
            className={inputCls}
          >
            <option value="Online">Online</option>
            <option value="Counter">Counter</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Event Date *</label>
          <div className="grid grid-cols-3 gap-3">
            <select required value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={inputCls}>
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d}</option>
              ))}
            </select>
            <select required value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
              <option value="">Month</option>
              {MONTHS.map((mo) => (
                <option key={mo.value} value={mo.value}>{mo.label}</option>
              ))}
            </select>
            <select required value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
              <option value="">Year</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>About</label>
          <textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="e.g. Grand folk opera theater with live orchestral music." className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* 2. Date & Time */}
      <SectionHeader n={2} title="Date & Time" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div>
          <label className={labelCls}>Gate Entry</label>
          <select value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className={inputCls}>
            <option value="">Select entry time</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Event Start</label>
          <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls}>
            <option value="">Select start time</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>End Time</label>
          <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls}>
            <option value="">Select end time</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Duration (auto)</label>
          <input
            type="text"
            value={duration}
            readOnly
            placeholder="Select start & end time"
            className={`${inputCls} bg-slate-100 text-slate-600 cursor-not-allowed`}
          />
        </div>
      </div>

      {/* 3. Party Contact Details */}
      <SectionHeader n={3} title="Party Contact Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Address *</label>
          <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. At/PO Khunta, Mayurbhanj, Odisha" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className={inputCls} />
        </div>
      </div>

      {/* 4. Cast & Crew */}
      <SectionHeader n={4} title="Cast & Crew" />
      <div className="space-y-3">
        {actors.map((actor, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-3 items-end bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <label className={labelCls}>Actor Name</label>
              <input type="text" value={actor.name} onChange={(e) => updateActor(i, 'name', e.target.value)} placeholder="e.g. Balakram Tudu" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Actor Photo URL</label>
              <input
                type="text"
                value={actor.photo}
                onChange={(e) => updateActor(i, 'photo', e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (text) {
                    e.preventDefault();
                    updateActor(i, 'photo', text.trim());
                  }
                }}
                placeholder="e.g. https://example.com/actor.jpg"
                className={inputCls}
              />
              <div className="mt-2 h-28 w-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                {actor.photo ? (
                  <img
                    key={actor.photo}
                    src={actor.photo}
                    alt="Actor preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = 'none';
                      const ph = el.parentElement?.querySelector('[data-ph]') as HTMLElement | null;
                      if (ph) ph.style.display = 'flex';
                    }}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      el.style.display = 'block';
                      const ph = el.parentElement?.querySelector('[data-ph]') as HTMLElement | null;
                      if (ph) ph.style.display = 'none';
                    }}
                  />
                ) : null}
                <span
                  data-ph
                  className="text-[9px] font-black text-slate-400 uppercase text-center px-2"
                  style={{ display: actor.photo ? 'none' : 'flex' }}
                >
                  Paste photo link
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActors((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
              className="mb-0.5 w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors flex-shrink-0"
              title="Remove actor"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setActors((prev) => [...prev, { name: '', photo: '' }])}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Actor
        </button>
      </div>

      {/* 5. Banner */}
      <SectionHeader n={5} title="Banner" />
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Main Banner URL</label>
          <input type="text" value={mainBanner} onChange={(e) => setMainBanner(e.target.value)} placeholder="e.g. https://example.com/main-banner.jpg" className={inputCls} />
          {mainBanner && (
            <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 h-40">
              <img
                key={mainBanner}
                src={mainBanner}
                alt="Main banner preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
              />
            </div>
          )}
        </div>
        <div className="space-y-3">
          {additionalBanners.map((banner, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="text"
                  value={banner}
                  onChange={(e) => setAdditionalBanners((prev) => prev.map((b, idx) => (idx === i ? e.target.value : b)))}
                  placeholder="e.g. https://example.com/banner-2.jpg"
                  className={inputCls}
                />
                {banner && (
                  <div className="mt-2 h-20 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src={banner}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAdditionalBanners((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors flex-shrink-0"
                title="Remove banner"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAdditionalBanners((prev) => [...prev, ''])}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Banner
          </button>
        </div>
      </div>

      {/* 6. Creative */}
      <SectionHeader n={6} title="Creative" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div>
          <label className={labelCls}>Writer</label>
          <input type="text" value={writer} onChange={(e) => setWriter(e.target.value)} placeholder="e.g. Balakram Tudu" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Director</label>
          <input type="text" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="e.g. Dasarath Singh" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Music Director</label>
          <input type="text" value={musicDirector} onChange={(e) => setMusicDirector(e.target.value)} placeholder="e.g. Pandit Soren" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Singer</label>
          <input type="text" value={singer} onChange={(e) => setSinger(e.target.value)} placeholder="e.g. Pandit Soren" className={inputCls} />
        </div>
      </div>

      {/* 7. Trailer */}
      <SectionHeader n={7} title="Trailer" />
      <div>
        <label className={labelCls}>YouTube Trailer URL</label>
        <div className="relative">
          <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="url"
            value={trailerUrl}
            onChange={(e) => setTrailerUrl(e.target.value)}
            placeholder="e.g. https://www.youtube.com/watch?v=..."
            className={`${inputCls} pl-10`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-end items-center gap-3">
        {enableDraft && (
          <button
            type="button"
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black rounded-xl transition-colors mr-auto"
          >
            <FileText className="w-3.5 h-3.5" />
            Save as Draft
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-6 py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md transition-all disabled:opacity-50 active:scale-95"
        >
          <Save className="w-3.5 h-3.5" />
          {submitLabel || 'Save Event'}
        </button>
      </div>
    </form>
  );
}
