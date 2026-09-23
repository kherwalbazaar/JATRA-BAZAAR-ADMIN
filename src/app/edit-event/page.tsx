'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, CalendarPlus } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '@/lib/firebase';
import EventForm from '@/components/EventForm';
import { EventItem } from '@/types';

function EditEventForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [eventData, setEventData] = useState<EventItem | null>(null);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    async function fetchEvent() {
      try {
        const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.EVENTS, id!));
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setEventData({ id: snap.id, ...snap.data() } as EventItem);
      } catch (err) {
        console.error('Failed to load event:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  const handleSave = async (data: Omit<EventItem, 'id'>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, FIRESTORE_COLLECTIONS.EVENTS, id!), { ...data });
      goBack();
    } catch (err) {
      console.error('Failed to update event:', err);
      alert('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.EVENTS, id!));
      goBack();
    } catch (err) {
      console.error('Failed to delete event:', err);
      alert('Failed to delete. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fc] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading event...
        </div>
      </div>
    );
  }

  if (notFound || !eventData) {
    return (
      <div className="min-h-screen bg-[#f4f6fc] flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-bold text-slate-500">Event not found</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

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
              <h1 className="text-sm font-black tracking-wide">Update Event</h1>
              <p className="text-[10px] text-slate-400 font-semibold">{eventData.title}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <EventForm
          initial={eventData}
          submitting={saving}
          submitLabel={saving ? 'Saving...' : 'Update Event'}
          onSubmit={handleSave}
          onCancel={goBack}
        />
      </div>
    </div>
  );
}

export default function EditEventPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6fc] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    }>
      <EditEventForm />
    </Suspense>
  );
}
