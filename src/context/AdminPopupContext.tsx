'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AdminPopupModal, { PopupOptions, PopupType, PopupItemSummary } from '@/components/AdminPopupModal';

interface ConfirmArgs {
  title: string;
  subtitle?: string;
  message: React.ReactNode;
  type?: PopupType;
  itemTitle?: string;
  itemSubtitle?: string;
  itemSummary?: PopupItemSummary;
  confirmText?: string;
  cancelText?: string;
  celebrate?: boolean;
}

interface AlertArgs {
  title: string;
  subtitle?: string;
  message: React.ReactNode;
  type?: PopupType;
  itemTitle?: string;
  itemSubtitle?: string;
  itemSummary?: PopupItemSummary;
  buttonText?: string;
  celebrate?: boolean;
}

interface AdminPopupContextType {
  confirm: (args: ConfirmArgs) => Promise<boolean>;
  alert: (args: AlertArgs) => Promise<void>;
  showPopup: (options: PopupOptions) => void;
  closePopup: () => void;
}

const AdminPopupContext = createContext<AdminPopupContextType | null>(null);

export function AdminPopupProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<PopupOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closePopup = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const showPopup = useCallback((options: PopupOptions) => {
    setCurrentOptions(options);
    setIsOpen(true);
  }, []);

  const confirm = useCallback((args: ConfirmArgs): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setCurrentOptions({
        ...args,
        showCancel: true,
        onConfirm: () => {
          resolve(true);
          resolverRef.current = null;
        },
        onCancel: () => {
          resolve(false);
          resolverRef.current = null;
        },
      });
      setIsOpen(true);
    });
  }, []);

  const alert = useCallback((args: AlertArgs): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      setCurrentOptions({
        ...args,
        showCancel: false,
        confirmText: args.buttonText || (args.type === 'created' || args.type === 'add' ? 'Awesome!' : 'OK'),
        onConfirm: () => {
          resolve();
          resolverRef.current = null;
        },
        onCancel: () => {
          resolve();
          resolverRef.current = null;
        },
      });
      setIsOpen(true);
    });
  }, []);

  return (
    <AdminPopupContext.Provider value={{ confirm, alert, showPopup, closePopup }}>
      {children}
      <AdminPopupModal
        isOpen={isOpen}
        options={currentOptions}
        onClose={closePopup}
      />
    </AdminPopupContext.Provider>
  );
}

export function useAdminPopup(): AdminPopupContextType {
  const context = useContext(AdminPopupContext);
  if (!context) {
    throw new Error('useAdminPopup must be used within an AdminPopupProvider');
  }
  return context;
}
