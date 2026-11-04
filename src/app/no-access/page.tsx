import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Landing page for a request that reached a section the session may not open.
 * Server-side checks already stopped the data — this only explains it.
 */
export default function NoAccessPage() {
  return (
    <main className="min-h-screen bg-white grid place-items-center px-5">
      <div className="max-w-md text-center">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h1 className="mt-4 text-2xl font-black text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          This section is not part of the features assigned to your committee. Ask a Super Admin to grant
          it, then refresh.
        </p>
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <Link href="/" className="inline-flex h-11 items-center px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
            My dashboard
          </Link>
          <Link href="/committee-status" className="inline-flex h-11 items-center px-5 border border-slate-300 text-sm font-bold text-slate-700">
            Application status
          </Link>
        </div>
      </div>
    </main>
  );
}
