'use client';

import React from 'react';

interface StageDiagramProps {
  /** Blocks to highlight (e.g. ["B1"] or ["All"] for every block). */
  highlightBlocks?: string[];
  /** Currently selected block (highlighted even without highlightBlocks). */
  activeBlock?: string | null;
  /** When provided, blocks become clickable. */
  onBlockClick?: (blockId: string) => void;
  /** Unique prefix so multiple diagrams on a page don't clash on gradient ids. */
  gradientIdPrefix?: string;
  /** Flush to container edges: no rounded corners / borders. */
  flush?: boolean;
  /** Optional display names per block id (overrides the drawn label). */
  labels?: Record<string, string>;
  /** Per-block channel text ("Counter" / "Online") shown under the block name. */
  channelLabels?: Record<string, string>;
  /** Per-block seat usage — blocks with every seat booked are drawn red. */
  seatStats?: Record<string, { total: number; booked: number }>;
  /** Block ids that are disabled — drawn dimmed and not clickable. */
  disabledBlocks?: string[];
  className?: string;
}

/** Aggregates seats per block: { total seats, booked seats }. */
export function buildSeatStats(
  seats: { blockId?: string; status?: string }[]
): Record<string, { total: number; booked: number }> {
  const stats: Record<string, { total: number; booked: number }> = {};
  for (const s of seats) {
    const id = s.blockId ? String(s.blockId).toUpperCase() : '';
    if (!id) continue;
    if (!stats[id]) stats[id] = { total: 0, booked: 0 };
    stats[id].total += 1;
    if (s.status === 'booked') stats[id].booked += 1;
  }
  return stats;
}

export default function StageDiagram({
  highlightBlocks = [],
  activeBlock = null,
  onBlockClick,
  gradientIdPrefix = 'stage',
  flush = false,
  labels,
  channelLabels,
  seatStats,
  disabledBlocks = [],
  className = ''
}: StageDiagramProps) {
  const isDisabled = (b: string) => disabledBlocks.includes(b);
  const label = (b: string) => (labels && labels[b] ? labels[b] : b);
  const sub = (b: string, fallback: string) =>
    channelLabels && channelLabels[b] ? channelLabels[b] : fallback;
  const isBlockActive = (b: string) =>
    highlightBlocks.includes('All') || highlightBlocks.includes(b) || activeBlock === b;
  // Colour rules: all seats booked -> red, Counter -> yellow, Online -> green.
  const isFull = (b: string) => {
    const s = seatStats?.[b];
    return !!s && s.total > 0 && s.booked >= s.total;
  };
  const fill = (b: string) => {
    if (isFull(b)) return '#dc2626';
    if (isDisabled(b)) return '#0f172a';
    const ch = channelLabels?.[b];
    if (!ch) return isBlockActive(b) ? '#0369a1' : '#1e293b';
    return ch === 'Counter' ? '#d97706' : '#16a34a';
  };
  const width = (b: string) => (isBlockActive(b) && !isDisabled(b) ? 3 : 1.5);
  const blockProps = (b: string) => ({
    className: 'sd-block',
    ...(isDisabled(b) ? { opacity: 0.35, style: { cursor: 'default' as const } } : {}),
    ...(!isDisabled(b) && onBlockClick
      ? {
          onClick: () => onBlockClick(b),
          style: { cursor: 'pointer' as const }
        }
      : {})
  });
  const stageGrad = `${gradientIdPrefix}Grad`;
  const stageBorder = `${gradientIdPrefix}BorderGrad`;

  return (
    <div
      className={`${
        flush
          ? 'bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-lg'
          : 'bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-3 shadow-lg border border-slate-700'
      } ${className}`}
    >
      <style>{`
        .sd-block { transition: filter 0.25s ease; }
        .sd-block:hover { filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.95)); }
        .sd-block:hover rect, .sd-block:hover polygon {
          stroke: #38bdf8;
          stroke-width: 3;
        }
        .sd-block:hover text:last-of-type { fill: #e2e8f0; }
      `}</style>
      <svg viewBox="0 0 1000 900" className="w-full h-auto select-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={stageGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={stageBorder} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="1" />
            <stop offset="50%" stopColor="#f472b6" stopOpacity="1" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="1000" height="900" fill="#0f172a" rx="20" />

        {/* STAGE (Center Top) */}
        <g>
          <rect x="370" y="40" width="260" height="360" fill={`url(#${stageGrad})`} stroke={`url(#${stageBorder})`} strokeWidth="4" rx="10" />
          <text x="500" y="185" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" letterSpacing="2">STAGE</text>
          <text x="500" y="220" textAnchor="middle" fill="#ffffff" fontSize="14" letterSpacing="4">FRONT</text>
        </g>

        {/* BLOCK C2 (Top Left) */}
        <g {...blockProps('C2')}>
          <rect x="40" y="40" width="310" height="190" fill={fill('C2')} stroke="#38bdf8" strokeWidth={width('C2')} rx="6" />
          <text x="195" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('C2')}</text>
          <text x="195" y="165" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('C2', 'Left Side')}</text>
        </g>

        {/* BLOCK A2 (Top Right) */}
        <g {...blockProps('A2')}>
          <rect x="650" y="40" width="310" height="190" fill={fill('A2')} stroke="#38bdf8" strokeWidth={width('A2')} rx="6" />
          <text x="805" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('A2')}</text>
          <text x="805" y="165" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('A2', 'Right Side')}</text>
        </g>

        {/* BLOCK C3 (Outer Left) */}
        <g {...blockProps('C3')}>
          <polygon points="40,250 170,250 170,680 40,840" fill={fill('C3')} stroke="#38bdf8" strokeWidth={width('C3')} />
          <text x="105" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('C3')}</text>
          <text x="105" y="550" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('C3', 'Left Side')}</text>
        </g>

        {/* BLOCK C1 (Inner Left) */}
        <g {...blockProps('C1')}>
          <polygon points="190,250 350,250 350,420 190,660" fill={fill('C1')} stroke="#38bdf8" strokeWidth={width('C1')} />
          <text x="270" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('C1')}</text>
          <text x="270" y="470" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('C1', 'Left Side')}</text>
        </g>

        {/* BLOCK A1 (Inner Right) */}
        <g {...blockProps('A1')}>
          <polygon points="650,250 810,250 810,660 650,420" fill={fill('A1')} stroke="#38bdf8" strokeWidth={width('A1')} />
          <text x="730" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('A1')}</text>
          <text x="730" y="470" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('A1', 'Right Side')}</text>
        </g>

        {/* BLOCK A3 (Outer Right) */}
        <g {...blockProps('A3')}>
          <polygon points="830,250 960,250 960,840 830,680" fill={fill('A3')} stroke="#38bdf8" strokeWidth={width('A3')} />
          <text x="895" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('A3')}</text>
          <text x="895" y="550" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('A3', 'Right Side')}</text>
        </g>

        {/* BLOCK B1 (Main Center Front Trapezoid) */}
        <g {...blockProps('B1')}>
          <polygon points="370,420 630,420 780,660 220,660" fill={fill('B1')} stroke="#38bdf8" strokeWidth={width('B1')} />
          <text x="500" y="540" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('B1')}</text>
          <text x="500" y="575" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('B1', 'Front Center')}</text>
        </g>

        {/* BLOCK B2 (Bottom Left) */}
        <g {...blockProps('B2')}>
          <polygon points="200,680 480,680 480,860 60,860" fill={fill('B2')} stroke="#38bdf8" strokeWidth={width('B2')} />
          <text x="290" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('B2')}</text>
          <text x="290" y="800" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('B2', 'Front Center')}</text>
        </g>

        {/* BLOCK B3 (Bottom Right) */}
        <g {...blockProps('B3')}>
          <polygon points="520,680 800,680 940,860 520,860" fill={fill('B3')} stroke="#38bdf8" strokeWidth={width('B3')} />
          <text x="710" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold">{label('B3')}</text>
          <text x="710" y="800" textAnchor="middle" fill="#94a3b8" fontSize="14">{sub('B3', 'Front Center')}</text>
        </g>
      </svg>
    </div>
  );
}
