'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Check, Copy, Loader2, X } from 'lucide-react';

interface CreateCommitteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type FieldName = 'committeeName' | 'email' | 'primaryMobile' | 'address' | 'eventDate';

type FormState = Record<FieldName, string>;

const EMPTY: FormState = { committeeName: '', email: '', primaryMobile: '', address: '', eventDate: '' };

interface Created {
  applicationRef: string;
  email: string;
  password: string;
}

const FIELD_CLS =
  'w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-green-800 placeholder:text-slate-400 disabled:opacity-60';
const LABEL_CLS = 'text-[10px] font-black uppercase text-slate-500 block mb-1';

/**
 * Super Admin shortcut around the public sign-up: the committee is created
 * already approved, and the generated password is revealed here once. It is not
 * stored anywhere in the panel, so closing this modal loses the only copy and
 * the admin is expected to have handed it over.
 */
export default function CreateCommitteeModal({ isOpen, onClose, onCreated }: CreateCommitteeModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState('');

  const dismiss = () => {
    setCreated(null);
    setForm(EMPTY);
    setErrors({});
    setBanner('');
    setCopied('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  const set = (key: FieldName) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setBanner('Copy is blocked in this browser — select the text and copy it manually.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBanner('');
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch('/api/committee-applications', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrors((data.fields || {}) as Partial<Record<FieldName, string>>);
        setBanner(data.error || 'Could not create the committee.');
        return;
      }
      setCreated({ applicationRef: data.applicationRef, email: data.email, password: data.password });
      onCreated();
    } catch {
      setBanner('Network problem. Nothing was created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && dismiss()} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-black tracking-wide">
              {created ? 'Committee ready' : 'Create Committee'}
            </span>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {created ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <p className="text-[11px] font-bold text-emerald-800">
                Approved and live. Application reference {created.applicationRef}.
              </p>
            </div>

            <p className="text-[11px] font-semibold text-slate-500">
              Hand these to the committee. This password is shown only now — the panel never stores it.
            </p>

            {[
              { label: 'Sign-in email', value: created.email },
              { label: 'Password', value: created.password },
            ].map((row) => (
              <div key={row.label}>
                <label className={LABEL_CLS}>{row.label}</label>
                <div className="flex items-center gap-2">
                  <p className="flex-1 min-w-0 truncate px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 select-all">
                    {row.value}
                  </p>
                  <button
                    onClick={() => copy(row.label, row.value)}
                    className="inline-flex h-9 items-center gap-1.5 px-3 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex-shrink-0"
                  >
                    {copied === row.label ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied === row.label ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}

            {banner && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl px-3 py-2.5">
                {banner}
              </div>
            )}

            <button
              onClick={dismiss}
              className="w-full py-3 bg-[#0f1430] hover:bg-[#1e2756] text-white text-xs font-black rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
            <p className="text-[11px] font-semibold text-slate-500">
              The committee is created approved, so it can sign in as soon as you hand over the password. It
              starts with no modules — grant them from its Permissions tab.
            </p>

            {banner && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-3 py-2.5">
                {banner}
              </div>
            )}

            {(
              [
                { name: 'committeeName', label: 'Committee Name', type: 'text', placeholder: 'Barabazar Durga Puja Committee' },
                { name: 'email', label: 'Sign-in Email', type: 'email', placeholder: 'committee@gmail.com' },
                { name: 'primaryMobile', label: 'Primary Mobile', type: 'tel', placeholder: '9583252256' },
                { name: 'eventDate', label: 'Event Date', type: 'date', placeholder: '' },
              ] as Array<{ name: FieldName; label: string; type: string; placeholder: string }>
            ).map((field) => (
              <div key={field.name}>
                <label className={LABEL_CLS} htmlFor={`committee-${field.name}`}>
                  {field.label}
                </label>
                <input
                  id={`committee-${field.name}`}
                  name={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={set(field.name)}
                  placeholder={field.placeholder}
                  disabled={saving}
                  className={`${FIELD_CLS} ${errors[field.name] ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}
                />
                {errors[field.name] && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}

            <div>
              <label className={LABEL_CLS} htmlFor="committee-address">
                Address
              </label>
              <textarea
                id="committee-address"
                name="address"
                rows={2}
                value={form.address}
                onChange={set('address')}
                placeholder="Village / town, district"
                disabled={saving}
                className={`${FIELD_CLS} resize-none ${errors.address ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}
              />
              {errors.address && <p className="mt-1 text-[11px] font-bold text-red-600">{errors.address}</p>}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={dismiss}
                disabled={saving}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-green-900 hover:bg-green-800 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Creating...' : 'Create Committee'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
