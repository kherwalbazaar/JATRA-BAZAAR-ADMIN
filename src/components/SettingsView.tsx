'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Printer, 
  ShieldCheck, 
  Bell, 
  Database, 
  QrCode, 
  Smartphone, 
  Save, 
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { EventItem } from '@/types';

interface SettingsViewProps {
  currentEvent: EventItem | null;
}

export default function SettingsView({ currentEvent }: SettingsViewProps) {
  const [printerPaper, setPrinterPaper] = useState('80mm');
  const [autoPrint, setAutoPrint] = useState(true);
  const [soundBeep, setSoundBeep] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <span>System & Hardware Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">
          Configure Box Office thermal printers, gate barcode scanners, sound alerts, and cloud sync.
        </p>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved and synced to all counter terminals!</span>
        </div>
      )}

      {/* POS Thermal Printer Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Thermal Slip & Receipt Printer</h3>
            <p className="text-[11px] text-slate-400 font-medium">ESC/POS USB & Bluetooth thermal ticket printing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
          <div>
            <label className="text-slate-600 font-bold block mb-1">Paper Roll Width</label>
            <select
              value={printerPaper}
              onChange={(e) => setPrinterPaper(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-slate-800 font-bold outline-none focus:border-indigo-500"
            >
              <option value="80mm">80mm (Standard POS Receipt with QR)</option>
              <option value="58mm">58mm (Compact Mobile Thermal)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 mt-auto">
            <div>
              <span className="text-slate-800 font-bold block">Instant Auto-Print</span>
              <span className="text-[10px] text-slate-400">Print slip automatically upon booking save</span>
            </div>
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Gate Scanner & Audio Alerts */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Gate Turnstile Scanner Options</h3>
            <p className="text-[11px] text-slate-400 font-medium">Camera and 2D barcode handheld reader configurations</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-slate-800 font-bold block">Audio Beep on Valid Ticket Scan</span>
            <span className="text-[10px] text-slate-400">Play confirmation tone to speed up gate verification</span>
          </div>
          <input
            type="checkbox"
            checked={soundBeep}
            onChange={(e) => setSoundBeep(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="flex items-center gap-2 bg-[#4f39f6] hover:bg-[#432ee0] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
      >
        <Save className="w-4 h-4" />
        <span>Save Settings</span>
      </button>
    </div>
  );
}
