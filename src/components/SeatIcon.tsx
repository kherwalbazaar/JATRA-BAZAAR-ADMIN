'use client';

import React from 'react';

interface SeatIconProps {
  label: string;
  selected?: boolean;
  size?: string;
  title?: string;
}

export default function SeatIcon({
  label,
  selected = true,
  size = 'w-10 h-10',
  title,
}: SeatIconProps) {
  const fill = selected ? '#ec4899' : '#334155';
  const stroke = selected ? '#ffffff' : '#94a3b8';
  const textFill = selected ? '#ffffff' : '#cbd5e1';
  const legStroke = selected ? '#ec4899' : '#94a3b8';
  const fontSize = label.length > 3 ? 4.5 : label.length > 2 ? 5 : 5.5;

  return (
    <span
      className="inline-flex items-center justify-center"
      title={title || label}
      aria-label={title || label}
    >
      <svg
        className={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="3.5"
          y="3"
          width="17"
          height="10"
          rx="2"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <rect
          x="1.5"
          y="7"
          width="2"
          height="6"
          rx="1"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.2"
        />
        <rect
          x="20.5"
          y="7"
          width="2"
          height="6"
          rx="1"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.2"
        />
        <rect
          x="2.5"
          y="13"
          width="19"
          height="4"
          rx="1"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <line x1="4.5" y1="17" x2="4.5" y2="22" stroke={legStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="19.5" y1="17" x2="19.5" y2="22" stroke={legStroke} strokeWidth="2" strokeLinecap="round" />
        <text
          x="12"
          y="9"
          fontSize={fontSize}
          fontWeight="bold"
          fill={textFill}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
      </svg>
    </span>
  );
}
