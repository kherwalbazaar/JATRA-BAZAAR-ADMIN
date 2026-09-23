'use client';

import React, { useState, useEffect } from 'react';
import { X, CalendarPlus, MapPin, Calendar, Image as ImageIcon } from 'lucide-react';
import { EventItem } from '@/types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (newEvent: EventItem) => void;
  onUpdateEvent?: (updatedEvent: EventItem) => void;
  editingEvent?: EventItem | null;
}

export default function CreateEventModal({
  isOpen,
  onClose,
  onAddEvent,
  onUpdateEvent,
  editingEvent
}: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [dateMode, setDateMode] = useState<'picker' | 'manual'>('picker');
  const [datePickerValue, setDatePickerValue] = useState('');
  const [date, setDate] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [poster, setPoster] = useState('');
  const [description, setDescription] = useState('');
  const [totalCapacity, setTotalCapacity] = useState('');

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setSubtitle(editingEvent.subtitle || '');
      setOrganization(editingEvent.organizer || '');
      setDate(editingEvent.date);
      setDay(editingEvent.day);
      setTime(editingEvent.time || '');
      setVenue(editingEvent.venue);
      setCity(editingEvent.city || '');
      setPoster(editingEvent.poster || '');
      setDescription(editingEvent.description || '');
      setTotalCapacity(editingEvent.totalCapacity ? String(editingEvent.totalCapacity) : '');
      setDateMode('manual');
    } else {
      setTitle('');
      setSubtitle('');
      setOrganization('');
      setDate('');
      setDay('');
      setTime('');
      setVenue('');
      setCity('');
      setPoster('');
      setDescription('');
      setTotalCapacity('');
      setDateMode('picker');
      setDatePickerValue('');
    }
  }, [editingEvent, isOpen]);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleDatePickerChange = (value: string) => {
    setDatePickerValue(value);
    if (value) {
      const d = new Date(value);
      const dayName = dayNames[d.getDay()];
      const formatted = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      setDate(formatted);
      setDay(dayName);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !venue.trim() || !date.trim()) {
      alert('Please fill event title, venue, and date');
      return;
    }

    const eventData: EventItem = {
      id: editingEvent?.id || `EVT-${Date.now().toString().slice(-4)}`,
      title: title.trim().toUpperCase(),
      subtitle: subtitle.trim(),
      date,
      day,
      time: time.trim(),
      venue: venue.trim(),
      city: city.trim(),
      status: editingEvent?.status || 'upcoming',
      poster: poster.trim(),
      totalCapacity: Number(totalCapacity) || 0,
      ticketsSold: editingEvent?.ticketsSold || 0,
      totalRevenue: editingEvent?.totalRevenue || 0,
      organizer: organization.trim(),
      description: description.trim()
    };

    if (editingEvent && onUpdateEvent) {
      onUpdateEvent(eventData);
    } else {
      onAddEvent(eventData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-[#0f1430] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">{editingEvent ? 'Update Event' : 'Create Jatra Bazaar Event'}</h3>
              <p className="text-[10px] text-slate-400 font-semibold">{editingEvent ? 'Edit Stage Show Details' : 'New Stage Show Schedule'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs font-semibold overflow-y-auto flex-1">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Party Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. ADIM OWAR JARPA OPERA"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Story Name</label>
            <input
              type="text"
              placeholder="e.g. Okoy Hirla rechom Bagiyanj Kan"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Organization Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Adim Lahah Mandawa"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Date *</label>
              {dateMode === 'picker' ? (
                <input
                  type="date"
                  value={datePickerValue}
                  onChange={(e) => handleDatePickerChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="e.g. 20 Aug 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              )}
              <button
                type="button"
                onClick={() => setDateMode(dateMode === 'picker' ? 'manual' : 'picker')}
                className="mt-1 text-[10px] text-indigo-600 font-bold hover:underline"
              >
                {dateMode === 'picker' ? 'Type manually' : 'Use date picker'}
              </button>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Day</label>
              <input
                type="text"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="e.g. Thursday"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Show Timing *</label>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 08:30 PM - 04:30 AM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Total Capacity</label>
              <input
                type="number"
                min="0"
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Location *</label>
            <input
              type="text"
              required
              placeholder="e.g. Bahanada, Khunta, Mayurbhanj"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">City / State *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mayurbhanj, Odisha"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the show, story, and highlights..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">Poster Image URL</label>
            <input
              type="text"
              value={poster}
              onChange={(e) => setPoster(e.target.value)}
              placeholder="Paste image URL..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            />
            {poster && (
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 h-40">
                <img
                  key={poster}
                  src={poster}
                  alt="Poster preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95"
            >
              {editingEvent ? 'Update Event' : 'Publish Event & Open Ticket Sales'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
