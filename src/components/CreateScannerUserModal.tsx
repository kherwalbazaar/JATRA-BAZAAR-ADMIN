'use client';

import React, { useState } from 'react';
import { X, UserPlus, Camera } from 'lucide-react';
import { GateInfo } from '@/types';
import * as fs from '@/lib/firestore';

interface CreateScannerUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  gates?: GateInfo[];
}

interface FormState {
  name: string;
  mobile: string;
  email: string;
  profilePhoto: string;
  assignedGateId: string;
  address: string;
}

const emptyForm: FormState = {
  name: '',
  mobile: '',
  email: '',
  profilePhoto: '',
  assignedGateId: '',
  address: '',
};

export default function CreateScannerUserModal({ isOpen, onClose, gates = [] }: CreateScannerUserModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.mobile.trim() || !form.email.trim()) {
      setError('Full Name, Mobile Number and Email are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!/^[+\d][\d\s-]{7,15}$/.test(form.mobile.trim())) {
      setError('Please enter a valid mobile number.');
      return;
    }

    setSaving(true);
    try {
      const created = await fs.addScannerMember({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        profilePhoto: form.profilePhoto.trim(),
        assignedGateId: form.assignedGateId,
        address: form.address.trim(),
      });
      alert(`User created: ${created.scannerId} (pending approval)`);
      setForm(emptyForm);
      onClose();
    } catch (err) {
      console.error('Create user failed:', err);
      setError('Failed to create user — check connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 placeholder:text-slate-400';
  const labelCls = 'text-[10px] font-black uppercase text-slate-500 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0f1430] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-black tracking-wide">Create User — Scanner Member</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          {/* Profile photo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.profilePhoto ? (
                <img src={form.profilePhoto} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <label className={labelCls}>Profile Photo URL</label>
              <input
                type="text"
                value={form.profilePhoto}
                onChange={set('profilePhoto')}
                placeholder="https://example.com/photo.jpg"
                className={fieldCls}
              />
            </div>
          </div>

          {/* Name + Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input type="text" required value={form.name} onChange={set('name')} placeholder="e.g. Balakram Tudu" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile Number *</label>
              <input type="tel" required value={form.mobile} onChange={set('mobile')} placeholder="+91 98765 43210" className={fieldCls} />
            </div>
          </div>

          {/* Email + Gate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="member@example.com" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Assigned Gate</label>
              <select value={form.assignedGateId} onChange={set('assignedGateId')} className={fieldCls}>
                <option value="">Not assigned</option>
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Address</label>
            <input type="text" value={form.address} onChange={set('address')} placeholder="Village / City, District" className={fieldCls} />
          </div>

          <p className="text-[10px] font-semibold text-slate-400">
            A unique Scanner ID (<b>SCN-xxx</b>) is generated automatically. New users start as{' '}
            <b>Pending + Active</b> and cannot scan until an admin approves them.
          </p>

          <div className="pt-1 flex gap-2.5 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Creating...' : '+ Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
