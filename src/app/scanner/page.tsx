'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LogOut,
  ScanLine,
  QrCode,
  Keyboard,
  Clock,
  Users,
  Ticket,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScannerMember, TicketEntry, EventItem, GateInfo } from '@/types';
import * as fs from '@/lib/firestore';

type Screen = 'login' | 'denied' | 'dashboard' | 'scanning';
type ResultKind = 'success' | 'already' | 'invalid' | 'denied';

interface ScanOutcome {
  kind: ResultKind;
  title: string;
  subtitle: string;
  ticketId?: string;
  audienceName?: string;
  persons?: number;
  previousEntryTime?: string;
  previousScannerName?: string;
  previousGateId?: string;
}

const SESSION_KEY = 'jatra_scanner_session';

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScannerPortalPage() {
  const router = useRouter();

  // Session / identity
  const [member, setMember] = useState<ScannerMember | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [deniedReason, setDeniedReason] = useState('');

  // Event / gate context (required for validation)
  const [events, setEvents] = useState<EventItem[]>([]);
  const [gates, setGates] = useState<GateInfo[]>([]);
  const [eventId, setEventId] = useState('');
  const [gateId, setGateId] = useState('');

  // Stats
  const [entries, setEntries] = useState<TicketEntry[]>([]);

  // Screens
  const [screen, setScreen] = useState<Screen>('login');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<{ detect: (src: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } | null>(null);
  const [camSupported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
  const [camState, setCamState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle');
  const [camError, setCamError] = useState('');
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const inFlightRef = useRef(false);
  const processCodeRef = useRef<((code: string) => Promise<void>) | null>(null);

  // ── Restore session ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const hasConnect = !!new URLSearchParams(window.location.search).get('connect');
      if (hasConnect) return;
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        fs.getScannerMemberOnce(saved).then((m) => {
          if (m) {
            setMember(m);
            setScreen('dashboard');
          }
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Auto-login from Connect Device QR (?connect=SCN-XXX) ─────────
  useEffect(() => {
    let cancelled = false;
    const autoConnect = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw =
          params.get('connect') ||
          params.get('sid') ||
          (() => {
            try {
              const hash = window.location.hash.replace(/^#/, '');
              if (!hash) return '';
              const hp = new URLSearchParams(hash);
              return hp.get('connect') || hp.get('sid') || '';
            } catch {
              return '';
            }
          })();
        if (!raw) return;
        let payloadSid = raw.trim();
        let payloadGate = '';
        if (raw.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.type === 'scanner_connect' || parsed?.scannerId) {
              payloadSid = String(parsed.scannerId || '');
              payloadGate = String(parsed.gate || '');
            }
          } catch {
            /* keep raw */
          }
        }
        const sid = payloadSid.toUpperCase().startsWith('SCN')
          ? payloadSid.toUpperCase()
          : `SCN-${payloadSid.replace(/^SCN-?/i, '')}`;
        if (!sid || cancelled) return;
        setLoggingIn(true);
        setLoginError('');
        const found = await fs.getScannerMemberByScannerId(sid);
        if (cancelled) return;
        if (!found) {
          setLoginError('No scanner found with this ID.');
          return;
        }
        if (found.approvalStatus === 'pending') {
          setDeniedReason('Your scanner account is waiting for admin approval.');
          setScreen('denied');
          return;
        }
        if (found.approvalStatus === 'rejected') {
          setDeniedReason('Your scanner access has been rejected by admin.');
          setScreen('denied');
          return;
        }
        if (found.accountStatus === 'deactivated') {
          setDeniedReason('Your scanner account has been deactivated.');
          setScreen('denied');
          return;
        }
        setMember(found);
        if (payloadGate) setGateId(payloadGate);
        try {
          sessionStorage.setItem(SESSION_KEY, found.id);
        } catch {
          /* ignore */
        }
        setScreen('dashboard');
        window.history.replaceState(null, '', window.location.pathname);
      } catch (err) {
        console.error('Connect auto-login failed:', err);
        if (!cancelled) setLoginError('Auto-login failed — enter Scanner ID manually.');
      } finally {
        if (!cancelled) setLoggingIn(false);
      }
    };
    autoConnect();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Events + entries (needed for scan context) ──────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(
        fs.listenEvents((evts) => {
          setEvents(evts);
          setEventId((prev) => prev || (evts[0]?.id ?? ''));
        })
      );
    } catch {
      /* ignore */
    }
    try {
      unsubs.push(fs.listenTicketEntries(setEntries));
    } catch {
      /* ignore */
    }
    return () => {
      unsubs.forEach((u) => u());
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gates for the selected event ─────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = fs.listenGates(eventId, (gts) => {
        setGates(gts);
        setGateId((prev) => (gts.some((g) => g.id === prev) ? prev : (gts[0]?.id ?? '')));
      });
    } catch {
      /* ignore */
    }
    return () => unsub?.();
  }, [eventId]);

  // ── Live member re-check (block mid-session deactivation) ────────
  useEffect(() => {
    if (!member?.id) return;
    let liveUnsub: (() => void) | undefined;
    try {
      liveUnsub = fs.listenScannerMembers((all) => {
        const fresh = all.find((m) => m.id === member.id);
        if (!fresh) return;
        setMember(fresh);
        if (fresh.approvalStatus !== 'approved' || fresh.accountStatus !== 'active') {
          setDeniedReason(
            fresh.approvalStatus === 'pending'
              ? 'Your scanner account is waiting for admin approval.'
              : fresh.approvalStatus === 'rejected'
                ? 'Your scanner access has been rejected by admin.'
                : 'Your scanner account has been deactivated.'
          );
          stopCamera();
          setScreen('denied');
        }
      });
    } catch {
      /* ignore */
    }
    return () => liveUnsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  const canScan = !!member && member.approvalStatus === 'approved' && member.accountStatus === 'active';

  const eventGates = useMemo(() => gates.filter((g) => !g.eventId || !eventId || g.eventId === eventId), [gates, eventId]);
  const currentEvent = events.find((e) => e.id === eventId) || null;
  const currentGate = gates.find((g) => g.id === gateId) || null;

  const stats = useMemo(() => {
    const mine = entries.filter((e) => e.memberId === member?.id);
    const today = new Date().toISOString().slice(0, 10);
    const todays = mine.filter((e) => (e.scannedAt || '').startsWith(today));
    return {
      todayEntries: todays.filter((e) => e.entryStatus === 'entered').length,
      successful: mine.filter((e) => e.scanResult === 'SUCCESS').length,
      alreadyUsed: mine.filter((e) => e.scanResult === 'ALREADY_USED').length,
      invalid: mine.filter((e) => e.scanResult === 'INVALID' || e.scanResult === 'WRONG_EVENT').length,
      recent: mine.slice(0, 8),
    };
  }, [entries, member?.id]);

  // ── Login ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const sid = loginId.trim().toUpperCase();
    if (!sid) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      const found = await fs.getScannerMemberByScannerId(sid.startsWith('SCN') ? sid : `SCN-${sid}`);
      if (!found) {
        setLoginError('No scanner found with this ID.');
        return;
      }
      if (found.approvalStatus === 'pending') {
        setDeniedReason('Your scanner account is waiting for admin approval.');
        setScreen('denied');
        return;
      }
      if (found.approvalStatus === 'rejected') {
        setDeniedReason('Your scanner access has been rejected by admin.');
        setScreen('denied');
        return;
      }
      if (found.accountStatus === 'deactivated') {
        setDeniedReason('Your scanner account has been deactivated.');
        setScreen('denied');
        return;
      }
      setMember(found);
      try {
        sessionStorage.setItem(SESSION_KEY, found.id);
      } catch {
        /* ignore */
      }
      setScreen('dashboard');
    } catch (err) {
      console.error('Scanner login failed:', err);
      setLoginError('Login failed — check your connection and try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    stopCamera();
    setMember(null);
    setScreen('login');
    setLoginId('');
    setOutcome(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  };

  // ── Camera control ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamState('idle');
  }, []);

  const detectLoop = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) return;
    if (video.readyState >= 2 && !inFlightRef.current) {
      inFlightRef.current = true;
      try {
        const codes = await detector.detect(video);
        const raw = codes?.[0]?.rawValue;
        if (raw) {
          const now = Date.now();
          if (!(lastScanRef.current.code === raw && now - lastScanRef.current.at < 2500)) {
            lastScanRef.current = { code: raw, at: now };
            await processCodeRef.current?.(raw);
          }
        }
      } catch {
        /* transient detect errors — keep looping */
      } finally {
        inFlightRef.current = false;
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    if (!camSupported) {
      setCamError('Camera QR scanning is not supported on this device/browser. Use manual entry.');
      setCamState('error');
      return;
    }
    setCamState('starting');
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const BD = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      if (!BD) throw new Error('BarcodeDetector unsupported');
      detectorRef.current = new BD({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] });
      setCamState('on');
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      console.error('Camera start failed:', err);
      setCamError('Camera access denied or unavailable. Use manual entry below.');
      setCamState('error');
      stopCamera();
    }
  };

  // ── Process a scanned / typed code ───────────────────────────────
  const processCode = async (code: string) => {
    if (!member || !canScan) return;
    if (!eventId || !gateId) {
      setOutcome({
        kind: 'invalid',
        title: 'SET EVENT & GATE',
        subtitle: 'Select the current event and gate before scanning.',
      });
      setScreen('scanning');
      stopCamera();
      return;
    }
    setBusy(true);
    try {
      const res = await fs.validateAndRecordEntry(code, {
        memberId: member.id,
        gateId,
        eventId,
      });

      let kind: ResultKind = 'invalid';
      let title = 'INVALID TICKET';
      let subtitle = res.message || 'This ticket could not be verified.';

      switch (res.result) {
        case 'SUCCESS':
          kind = 'success';
          title = 'ENTRY ALLOWED';
          subtitle = 'Ticket verified successfully.';
          confetti({ particleCount: 70, spread: 75, origin: { y: 0.6 } });
          break;
        case 'ALREADY_USED':
          kind = 'already';
          title = 'ALREADY USED';
          subtitle = 'This ticket has already been used for entry.';
          break;
        case 'CANCELLED':
          kind = 'invalid';
          title = 'TICKET CANCELLED';
          subtitle = 'This ticket has been cancelled.';
          break;
        case 'UNPAID':
          kind = 'invalid';
          title = 'NOT ELIGIBLE';
          subtitle = 'This ticket is not eligible for entry.';
          break;
        case 'WRONG_EVENT':
          kind = 'invalid';
          title = 'WRONG EVENT';
          subtitle = 'This ticket belongs to another event.';
          break;
        case 'SCANNER_DENIED':
          kind = 'denied';
          title = 'SCANNER BLOCKED';
          subtitle = res.message || 'Your scanner access is blocked.';
          setDeniedReason(subtitle);
          break;
        case 'INVALID':
          kind = 'invalid';
          title = 'INVALID TICKET';
          subtitle = 'This ticket could not be verified.';
          break;
      }

      setOutcome({
        kind,
        title,
        subtitle,
        ticketId: res.ticketId || (kind === 'success' || kind === 'already' ? code.trim().toUpperCase() : undefined),
        audienceName: res.audienceName,
        persons: res.persons,
        previousEntryTime: res.previousEntryTime,
        previousScannerName: res.previousScannerName,
        previousGateId: res.previousGateId,
      });
      setScreen('scanning');
      stopCamera();
      if (kind === 'denied') setScreen('denied');
    } catch (err) {
      console.error('Scan failed:', err);
      setOutcome({
        kind: 'invalid',
        title: 'SCAN FAILED',
        subtitle: 'Could not verify the ticket — check connection and try again.',
      });
      setScreen('scanning');
      stopCamera();
    } finally {
      setBusy(false);
      setManualCode('');
    }
  };

  // Keep the camera loop pointed at the latest processCode
  processCodeRef.current = processCode;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = manualCode.trim();
    if (c) processCode(c);
  };

  const scanNext = () => {
    setOutcome(null);
    setScreen('scanning');
  };

  // ── Screens ──────────────────────────────────────────────────────

  if (screen === 'denied') {
    return (
      <div className="min-h-screen bg-[#0f1430] text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">ACCESS BLOCKED</h1>
            <p className="text-sm font-semibold text-slate-400 mt-2">{deniedReason || 'You cannot scan tickets right now.'}</p>
          </div>
          <button
            onClick={() => {
              setScreen('login');
              setMember(null);
              setDeniedReason('');
              try {
                sessionStorage.removeItem(SESSION_KEY);
              } catch {
                /* ignore */
              }
            }}
            className="w-full py-3 bg-white/10 hover:bg-white/15 text-white text-xs font-black rounded-xl transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'login' || !member) {
    return (
      <div className="min-h-screen bg-[#0f1430] text-white flex flex-col">
        <div className="p-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={handleLogin} className="max-w-xs w-full space-y-5">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center mx-auto">
                <ScanLine className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-xl font-black tracking-tight">
                <span className="text-amber-400">JATRA</span> BAZAAR Scanner
              </h1>
              <p className="text-xs font-semibold text-slate-400">Sign in with your Scanner ID (SCN-xxx)</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Scanner ID</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="SCN-001"
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-black font-mono text-white placeholder-slate-600 outline-none focus:border-indigo-500 text-center tracking-widest"
              />
            </div>

            {loginError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-red-300">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn || !loginId.trim()}
              className="w-full py-3.5 bg-[#4f39f6] hover:bg-[#432ee0] text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-[10px] font-semibold text-slate-500 text-center">
              Only approved + active scanners can enter.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────
  if (screen === 'scanning' && outcome) {
    const styles: Record<ResultKind, { bg: string; ring: string; text: string; icon: React.ReactNode }> = {
      success: { bg: 'bg-emerald-500', ring: 'ring-emerald-400/40', text: 'text-white', icon: <CheckCircle2 className="w-20 h-20" /> },
      already: { bg: 'bg-amber-500', ring: 'ring-amber-400/40', text: 'text-white', icon: <Clock className="w-20 h-20" /> },
      invalid: { bg: 'bg-red-500', ring: 'ring-red-400/40', text: 'text-white', icon: <XCircle className="w-20 h-20" /> },
      denied: { bg: 'bg-slate-700', ring: 'ring-slate-500/40', text: 'text-white', icon: <ShieldAlert className="w-20 h-20" /> },
    };
    const st = styles[outcome.kind];

    return (
      <div className={`min-h-screen ${st.bg} ${st.text} flex flex-col items-center justify-center p-6 text-center`}>
        <div className={`rounded-full ${st.ring} ring-4 p-4 mb-6 animate-in zoom-in-75 duration-200`}>{st.icon}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{outcome.title}</h1>
        <p className="text-sm font-semibold opacity-90 mt-2 max-w-sm">{outcome.subtitle}</p>

        <div className="mt-6 space-y-1.5 w-full max-w-xs">
          {outcome.ticketId && (
            <div className="bg-black/20 rounded-xl py-2.5 px-4">
              <span className="text-[10px] font-black uppercase opacity-70 block">Ticket</span>
              <span className="text-base font-black font-mono tracking-wider">{outcome.ticketId}</span>
            </div>
          )}
          {outcome.audienceName && (
            <div className="bg-black/20 rounded-xl py-2.5 px-4">
              <span className="text-[10px] font-black uppercase opacity-70 block">Audience</span>
              <span className="text-sm font-black">
                {outcome.audienceName}
                {outcome.persons ? ` • ${outcome.persons} person${outcome.persons > 1 ? 's' : ''}` : ''}
              </span>
            </div>
          )}
          {outcome.kind === 'already' && outcome.previousEntryTime && (
            <div className="bg-black/20 rounded-xl py-2.5 px-4">
              <span className="text-[10px] font-black uppercase opacity-70 block">First Entered</span>
              <span className="text-xs font-bold">
                {fmtTime(outcome.previousEntryTime)}
                {outcome.previousScannerName ? ` by ${outcome.previousScannerName}` : ''}
                {outcome.previousGateId ? ` at ${outcome.previousGateId}` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={scanNext}
            className="w-full py-4 bg-white text-slate-900 text-sm font-black rounded-xl shadow-xl active:scale-95 transition-all"
          >
            SCAN NEXT TICKET
          </button>
          <button
            onClick={() => {
              setOutcome(null);
              setScreen('dashboard');
            }}
            className="w-full py-3 bg-black/20 hover:bg-black/30 text-white text-xs font-black rounded-xl transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Scanning screen (camera) ─────────────────────────────────────
  if (screen === 'scanning') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0f1430] border-b border-white/10">
          <button
            onClick={() => {
              stopCamera();
              setScreen('dashboard');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <span className="text-xs font-black font-mono text-indigo-300">{member.scannerId}</span>
          <span className="text-[10px] font-black text-slate-500">{currentGate?.name || gateId || 'NO GATE'}</span>
        </div>

        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />

          {camState !== 'on' && (
            <div className="relative z-10 text-center p-6 space-y-4 max-w-xs">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8 text-slate-400" />
              </div>
              {camState === 'starting' ? (
                <p className="text-sm font-bold text-slate-300">Starting camera...</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-300">
                    {camError || 'Point the camera at the audience ticket QR code.'}
                  </p>
                  <button
                    onClick={startCamera}
                    className="w-full py-3 bg-[#4f39f6] text-white text-xs font-black rounded-xl active:scale-95 transition-all"
                  >
                    START CAMERA
                  </button>
                </>
              )}
            </div>
          )}

          {/* Scan frame overlay */}
          {camState === 'on' && (
            <>
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-64 sm:h-64">
                <div className="absolute inset-0 border-4 border-indigo-400/30 rounded-2xl" />
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-2xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-2xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-2xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-2xl" />
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-indigo-400/70 animate-pulse" />
              </div>
              <div className="absolute bottom-32 inset-x-0 text-center">
                <span className="text-xs font-black text-white/80 bg-black/50 px-4 py-2 rounded-full">
                  Align QR inside the frame
                </span>
              </div>
            </>
          )}
        </div>

        {/* Manual fallback + toggle */}
        <div className="bg-[#0f1430] border-t border-white/10 p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => (camState === 'on' ? stopCamera() : startCamera())}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {camState === 'on' ? (
                <>
                  <CameraOff className="w-4 h-4" /> Stop Camera
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" /> Start Camera
                </>
              )}
            </button>
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Keyboard className="w-4 h-4" /> Manual Entry
            </button>
          </div>

          {manualOpen && (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ticket # e.g. JB-1234"
                autoCapitalize="characters"
                className="flex-1 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black font-mono text-white placeholder-slate-600 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={busy || !manualCode.trim()}
                className="px-5 py-3 bg-[#4f39f6] text-white text-xs font-black rounded-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? '...' : 'GO'}
              </button>
            </form>
          )}

          {busy && (
            <p className="text-center text-[11px] font-bold text-indigo-300">Validating ticket...</p>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f6fc] text-slate-800">
      <div className="bg-[#0f1430] text-white px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white" aria-label="Back to admin">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight truncate">
              <span className="text-amber-400">JATRA</span> BAZAAR Scanner
            </h1>
            <p className="text-[10px] font-bold text-slate-400 font-mono">{member.scannerId} • {member.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-black px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            ● Can Scan
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-black rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-5">
        {/* Event / gate selectors */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Scan Context</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {events.length === 0 && <option value="">No events</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Gate</label>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {eventGates.length === 0 && <option value="">No gates</option>}
                {eventGates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!currentEvent && events.length > 0 && (
            <p className="text-[10px] font-bold text-red-500">Select an event to start scanning.</p>
          )}
          {eventGates.length === 0 && (
            <p className="text-[10px] font-bold text-amber-600">No gates configured — add a gate first.</p>
          )}
        </div>

        {/* Big scan button */}
        <button
          onClick={() => {
            if (!canScan) {
              setDeniedReason('Your scanner access is blocked.');
              setScreen('denied');
              return;
            }
            if (!eventId || !gateId) {
              alert('Select event and gate first.');
              return;
            }
            setOutcome(null);
            setScreen('scanning');
            startCamera();
          }}
          disabled={!canScan || !eventId || !gateId}
          className="w-full py-5 bg-[#4f39f6] hover:bg-[#432ee0] text-white rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ScanLine className="w-6 h-6" />
          <span className="text-base font-black tracking-wide">SCAN TICKET</span>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Today's Entries", value: stats.todayEntries, icon: <CalendarDaysIcon />, cls: 'text-indigo-600 bg-indigo-50' },
            { label: 'Successful', value: stats.successful, icon: <CheckCircle2 className="w-4 h-4" />, cls: 'text-emerald-600 bg-emerald-50' },
            { label: 'Already Used', value: stats.alreadyUsed, icon: <Clock className="w-4 h-4" />, cls: 'text-amber-600 bg-amber-50' },
            { label: 'Invalid', value: stats.invalid, icon: <XCircle className="w-4 h-4" />, cls: 'text-red-600 bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.cls}`}>{s.icon}</div>
              <span className="text-xl font-black text-slate-900 leading-none block">{s.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Recent scans */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700">Recent Scans</span>
            <button onClick={() => {}} className="text-slate-400 hover:text-slate-600" aria-label="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {stats.recent.length === 0 ? (
            <div className="py-10 text-center">
              <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-400">No scans yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent.map((e) => {
                const ok = e.scanResult === 'SUCCESS';
                return (
                  <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono font-black text-slate-800 block truncate">{e.ticketId}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{e.audienceName || '—'}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        {ok ? '✓ Entered' : e.scanResult.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{fmtTime(e.scannedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Member footer */}
        <div className="text-center pb-4 space-y-1">
          <p className="text-[11px] font-black text-slate-500">
            {member.name} • {member.scannerId}
          </p>
          <p className="text-[10px] font-semibold text-slate-400">
            Total scans: {member.totalScans || 0} • Last active: {fmtTime(member.lastScanAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Small local icon wrapper so dashboard grid stays tidy
function CalendarDaysIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}
