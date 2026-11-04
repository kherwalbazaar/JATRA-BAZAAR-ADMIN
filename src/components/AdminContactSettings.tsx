'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Phone, MessageCircle, Mail, Save, Headphones, CheckCircle2 } from 'lucide-react';
import { useAdminPopup } from '@/context/AdminPopupContext';

interface Contact {
  contactName: string;
  primaryMobile: string;
  whatsappNumber: string;
  supportEmail: string;
  supportMessage: string;
}

const EMPTY: Contact = {
  contactName: '',
  primaryMobile: '',
  whatsappNumber: '',
  supportEmail: '',
  supportMessage: '',
};

/**
 * Super Admin → Settings → Contact Information.
 * These values are what committees see on their waiting page, so nothing about
 * how to reach the administration is hardcoded in source.
 */
export default function AdminContactSettings() {
  const { alert } = useAdminPopup();
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-contact', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data?.success) setContact({ ...EMPTY, ...data.contact });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof Contact) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setContact((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin-contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        await alert({ type: 'error', title: 'Not saved', message: data.error || 'Request failed.' });
        return;
      }
      setContact({ ...EMPTY, ...data.contact });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      await alert({ type: 'error', title: 'Not saved', message: 'Network problem.' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Contact, label: string, hint: string, type = 'text') => (
    <div>
      <label htmlFor={`contact-${key}`} className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
        {label}
      </label>
      <input
        id={`contact-${key}`}
        type={type}
        value={contact[key]}
        onChange={set(key)}
        placeholder={hint}
        className="mt-1.5 w-full h-10 px-3 text-[13px] border border-slate-300 bg-white outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15"
      />
    </div>
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
          <Headphones className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900">Admin Contact Information</h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Shown on the committee waiting, rejection and deactivation pages
          </p>
        </div>
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('contactName', 'Admin contact name', 'Jatra Bazaar Office')}
            {field('primaryMobile', 'Primary mobile number', '9876543210', 'tel')}
            {field('whatsappNumber', 'WhatsApp number', '919876543210', 'tel')}
            {field('supportEmail', 'Support email', 'support@example.com', 'email')}
          </div>

          <div>
            <label htmlFor="contact-supportMessage" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
              Support message
            </label>
            <textarea
              id="contact-supportMessage"
              rows={2}
              value={contact.supportMessage}
              onChange={set('supportMessage')}
              placeholder="Applications are reviewed every morning between 10 AM and 1 PM."
              className="mt-1.5 w-full p-3 text-[13px] border border-slate-300 bg-white outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15 resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 px-4 bg-green-800 hover:bg-green-900 disabled:opacity-60 text-white text-[13px] font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save contact information'}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-green-800">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>

          {(contact.primaryMobile || contact.whatsappNumber || contact.supportEmail) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {contact.primaryMobile && (
                <a
                  href={`tel:${contact.primaryMobile}`}
                  className="inline-flex h-8 items-center gap-1.5 px-3 border border-slate-300 text-[11px] font-bold text-slate-600"
                >
                  <Phone className="w-3.5 h-3.5" /> Preview call
                </a>
              )}
              {contact.whatsappNumber && (
                <a
                  href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 px-3 border border-slate-300 text-[11px] font-bold text-slate-600"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Preview WhatsApp
                </a>
              )}
              {contact.supportEmail && (
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="inline-flex h-8 items-center gap-1.5 px-3 border border-slate-300 text-[11px] font-bold text-slate-600"
                >
                  <Mail className="w-3.5 h-3.5" /> Preview email
                </a>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
