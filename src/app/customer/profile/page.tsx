import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CustomerProfileFlow from '@/components/customer/CustomerProfileFlow';

export const metadata = {
  title: 'Customer Profile | JATRA BAZAAR',
  description: 'Customer profile creation and management portal',
};

export default function CustomerProfilePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d122c] to-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Top back navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Admin Panel</span>
        </Link>
        <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg">
          Audience Portal
        </span>
      </div>

      <CustomerProfileFlow />
    </main>
  );
}
