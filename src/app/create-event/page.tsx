'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '@/lib/firebase';
import EventForm from '@/components/EventForm';
import { EventItem } from '@/types';

export default function CreateEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleCreate = async (data: Omit<EventItem, 'id'>) => {
    setSaving(true);
    try {
      await addDoc(collection(db, FIRESTORE_COLLECTIONS.EVENTS), data);
      goBack();
    } catch (err) {
      console.error('Failed to create event:', err);
      alert('Failed to create event. Try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      {/* Top Bar */}
      <div className="bg-[#0f1430] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide">Create New Event</h1>
              <p className="text-[10px] text-slate-400 font-semibold">All sections as per database structure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <EventForm
          submitting={saving}
          submitLabel={saving ? 'Creating...' : 'Create Event'}
          enableDraft
          onSubmit={handleCreate}
          onCancel={goBack}
        />
      </div>
    </div>
  );
}
