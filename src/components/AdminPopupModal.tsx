'use client';

import React, { useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  Sparkles,
  PlusCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export type PopupType =
  | 'create'
  | 'created'
  | 'add'
  | 'added'
  | 'update'
  | 'updated'
  | 'edit'
  | 'delete'
  | 'deleted'
  | 'warning'
  | 'info'
  | 'error';

export interface PopupItemSummary {
  title?: string;
  subtitle?: string;
  badge?: string;
}

export interface PopupOptions {
  type?: PopupType;
  title: string;
  subtitle?: string;
  message: React.ReactNode;
  itemTitle?: string;
  itemSubtitle?: string;
  itemSummary?: PopupItemSummary;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  celebrate?: boolean;
}

interface AdminPopupModalProps {
  isOpen: boolean;
  options: PopupOptions | null;
  onClose: () => void;
  isLoading?: boolean;
}

export default function AdminPopupModal({
  isOpen,
  options,
  onClose,
  isLoading = false,
}: AdminPopupModalProps) {
  useEffect(() => {
    if (!isOpen || !options) return;

    // Trigger celebratory confetti on create/add or when explicitly requested
    const isAddType =
      options.type === 'create' ||
      options.type === 'created' ||
      options.type === 'add' ||
      options.type === 'added';

    if ((isAddType || options.celebrate) && typeof window !== 'undefined') {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#6366f1', '#ec4899', '#f59e0b'],
          disableForReducedMotion: true,
        });
      } catch {
        /* ignore fallback */
      }
    }
  }, [isOpen, options]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        options?.onCancel?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose, options]);

  if (!isOpen || !options) return null;

  const type = options.type || 'info';

  // Determine vibrant colorful styling according to action
  let gradientHeader = 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600';
  let confirmBtnGradient = 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25';
  let IconComponent = Info;
  let defaultSubtitle = 'Action Required';
  let defaultConfirmText = 'Confirm';

  switch (type) {
    case 'create':
    case 'created':
    case 'add':
    case 'added':
      gradientHeader = 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600';
      confirmBtnGradient = 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25';
      IconComponent = type === 'add' || type === 'create' ? PlusCircle : CheckCircle2;
      defaultSubtitle = 'Success & Added';
      defaultConfirmText = options.showCancel === false ? 'Great, Got it!' : 'Yes, Create';
      break;

    case 'update':
    case 'updated':
    case 'edit':
      gradientHeader = 'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600';
      confirmBtnGradient = 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-indigo-500/25';
      IconComponent = type === 'updated' ? Sparkles : RefreshCw;
      defaultSubtitle = 'Changes & Updates';
      defaultConfirmText = options.showCancel === false ? 'Acknowledged' : 'Save Changes';
      break;

    case 'delete':
    case 'deleted':
      gradientHeader = 'bg-gradient-to-br from-rose-600 via-pink-600 to-red-600';
      confirmBtnGradient = 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25';
      IconComponent = Trash2;
      defaultSubtitle = 'Permanent Action';
      defaultConfirmText = options.showCancel === false ? 'Dismiss' : 'Yes, Delete';
      break;

    case 'warning':
      gradientHeader = 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600';
      confirmBtnGradient = 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-orange-500/25';
      IconComponent = AlertTriangle;
      defaultSubtitle = 'Please Review';
      defaultConfirmText = 'Proceed';
      break;

    case 'error':
      gradientHeader = 'bg-gradient-to-br from-red-600 via-rose-600 to-orange-600';
      confirmBtnGradient = 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/25';
      IconComponent = AlertCircle;
      defaultSubtitle = 'Attention Needed';
      defaultConfirmText = 'Understand';
      break;

    default:
      gradientHeader = 'bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600';
      confirmBtnGradient = 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-purple-500/25';
      IconComponent = HelpCircle;
      defaultSubtitle = 'System Notice';
      defaultConfirmText = 'Continue';
      break;
  }

  const showCancelButton = options.showCancel !== false;
  const confirmText = options.confirmText || defaultConfirmText;
  const cancelText = options.cancelText || 'Cancel';
  const subtitle = options.subtitle || defaultSubtitle;

  const handleConfirmClick = async () => {
    if (options.onConfirm) {
      await options.onConfirm();
    }
    onClose();
  };

  const handleCancelClick = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Background Dim & Backdrop Blur */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (!isLoading) handleCancelClick();
        }}
      />

      {/* Centered Modal Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.35)] overflow-hidden border border-white/20 animate-in zoom-in-95 fade-in duration-200 z-10 my-auto">
        {/* Vibrant Gradient Header */}
        <div className={`relative ${gradientHeader} px-6 pt-7 pb-8 text-center text-white overflow-hidden`}>
          {/* Decorative floating glass circles */}
          <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-white/10 blur-xs pointer-events-none" />
          <div className="absolute -bottom-14 -right-8 w-40 h-40 rounded-full bg-white/10 blur-xs pointer-events-none" />
          <div className="absolute top-4 right-12 w-8 h-8 rounded-full bg-white/15 pointer-events-none" />
          <div className="absolute top-12 left-6 w-4 h-4 rounded-full bg-white/20 pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleCancelClick}
            disabled={isLoading}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 active:scale-95 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm disabled:opacity-50"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Luminous Centered Icon with Glow */}
          <div className="relative inline-flex items-center justify-center w-18 h-18 rounded-3xl bg-white/20 backdrop-blur-md mb-3 shadow-xl ring-4 ring-white/20 transition-transform transform hover:scale-105 duration-200">
            <IconComponent className="w-9 h-9 text-white drop-shadow-md" />
          </div>

          <h3 className="text-xl font-black text-white tracking-tight drop-shadow-sm px-2">
            {options.title}
          </h3>
          <p className="text-[11px] font-extrabold text-white/85 tracking-wider uppercase mt-1">
            {subtitle}
          </p>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Primary Message */}
          <div className="text-sm font-semibold text-slate-600 text-center leading-relaxed">
            {options.message}
          </div>

          {/* Item Highlight Badge / Card (if item details provided) */}
          {Boolean(options.itemTitle || options.itemSubtitle || options.itemSummary) && (
            <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-slate-50 to-slate-100/90 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {(options.itemTitle || options.itemSummary?.title) && (
                    <p className="text-xs font-black text-slate-800 truncate">
                      {options.itemTitle || options.itemSummary?.title}
                    </p>
                  )}
                  {options.itemSummary?.badge && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex-shrink-0">
                      {options.itemSummary.badge}
                    </span>
                  )}
                </div>
                {(options.itemSubtitle || options.itemSummary?.subtitle) && (
                  <p className="text-[11px] font-bold text-slate-500 truncate mt-0.5">
                    {options.itemSubtitle || options.itemSummary?.subtitle}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 pb-6 pt-1 flex items-center gap-3">
          {showCancelButton && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs font-black rounded-2xl transition-all duration-150 disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 text-white text-xs font-black rounded-2xl shadow-md active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-60 ${confirmBtnGradient}`}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
