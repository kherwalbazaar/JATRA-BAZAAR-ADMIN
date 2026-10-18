'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Ticket,
  User,
  Phone,
  Banknote,
  QrCode,
  CreditCard,
  Printer,
  Lock,
  ChevronRight,
  Headphones,
  Minus,
  Plus,
  AlertCircle,
  Armchair
} from 'lucide-react';
import { TicketType, BookingItem, EventItem, Seat } from '@/types';
import StageDiagram, { buildSeatStats } from '@/components/StageDiagram';
import { generateBookingId, formatINR } from '@/lib/utils';
import { useBlockCategories } from '@/hooks/useBlockCategories';
import confetti from 'canvas-confetti';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEvent: EventItem | null;
  ticketTypes: TicketType[];
  seats?: Seat[];
  /** Seats picked on the counter seat grid — booked atomically with this order. */
  counterSelection?: { block: string; seats: string[] }[] | null;
  onAddBooking: (
    newBooking: BookingItem,
    seatGroups?: { block: string; seats: string[] }[]
  ) => void | Promise<void>;
  onBooked?: () => void;
  onPrintDirect: (booking: BookingItem) => void;
}

const PAYMENT_METHODS = [
  { key: 'Cash' as const, Icon: Banknote, title: 'Cash at Counter', desc: 'Pay at the ticket counter' },
  { key: 'UPI' as const, Icon: QrCode, title: 'UPI / QR', desc: 'Pay using any UPI app' },
  { key: 'Card' as const, Icon: CreditCard, title: 'Card', desc: 'Credit / Debit card at POS' }
];

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">
        {number}
      </span>
      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

export default function NewBookingModal({
  isOpen,
  onClose,
  currentEvent,
  ticketTypes,
  seats = [],
  counterSelection = null,
  onAddBooking,
  onBooked,
  onPrintDirect
}: NewBookingModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(ticketTypes[0]?.id || 'TT-01');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { labels: blockLabels, channelLabels, disabledBlocks } = useBlockCategories();
  const seatStats = React.useMemo(() => buildSeatStats(seats), [seats]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const isCounterSeatMode = Boolean(counterSelection && counterSelection.length > 0);
  const [removedSeatIds, setRemovedSeatIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRemovedSeatIds(new Set());
  }, [isOpen, counterSelection]);

  const activeCounterSelection = React.useMemo(() => {
    if (!counterSelection) return null;
    return counterSelection
      .map((g) => ({
        block: g.block,
        seats: g.seats.filter((id) => !removedSeatIds.has(id))
      }))
      .filter((g) => g.seats.length > 0);
  }, [counterSelection, removedSeatIds]);

  const counterSeats = React.useMemo(() => {
    return (activeCounterSelection || []).flatMap((g) => g.seats);
  }, [activeCounterSelection]);

  const effQuantity = isCounterSeatMode ? counterSeats.length : quantity;

  const handleRemoveSeat = (seatId: string) => {
    setRemovedSeatIds((prev) => new Set([...prev, seatId]));
  };

  const selectedTier = ticketTypes.find((t) => t.id === selectedTypeId) || ticketTypes[0];
  const tierUnitPrice = selectedTier ? selectedTier.price : 50;

  const findSeatObj = (seatId: string): Seat | undefined =>
    seats.find((s) => s.id === seatId || (s as any).seatId === seatId);

  // Same block/row matching the counter seat grid uses — keeps the booking
  // record aligned with the tier that actually owns the selected seats.
  const getTicketTypeForSeat = (seat: Seat): TicketType | undefined =>
    ticketTypes.find((tt) => {
      const sBlock = (seat.blockId || '').trim().toUpperCase();
      const sRow = (seat.rowId || '').toUpperCase();
      const blocks = (tt.blocks || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
      const blocksMatch =
        blocks.length === 0 || blocks.includes('ALL') || (sBlock && blocks.includes(sBlock));
      const rows = (tt.rows || []).map((r) => r.trim().toUpperCase()).filter(Boolean);
      const baseRow = sRow.replace(/[0-9]/g, '');
      const rowsMatch =
        rows.length === 0 || rows.includes('ALL') || (sRow && rows.includes(sRow)) || (baseRow && rows.includes(baseRow));
      return blocksMatch && rowsMatch;
    });

  const getSeatInfo = (seatId: string, blockFallback: string = ''): {
    id: string;
    block: string;
    row: string;
    seatNumber: number | string;
    label: string;
    price: number;
    ticketType?: TicketType;
  } => {
    const s = findSeatObj(seatId);
    let block = (s?.blockId || blockFallback || '').trim().toUpperCase();
    let row = (s?.rowId || '').trim().toUpperCase();
    let seatNumber: number | string = s?.seatNumber ?? '';
    let label = (s?.seatLabel || '').trim();

    if (!block || !row || !label) {
      const parts = seatId.split('-');
      if (parts.length >= 3) {
        if (!block) block = parts[0].toUpperCase();
        if (!row) row = parts[1].toUpperCase();
        if (!seatNumber) seatNumber = parts[2];
        if (!label) label = `${parts[1]}${parts[2]}`;
      } else if (parts.length === 2) {
        if (!row) row = parts[0].toUpperCase();
        if (!seatNumber) seatNumber = parts[1];
        if (!label) label = `${parts[0]}${parts[1]}`;
      }
    }

    if (!label) {
      label = row && seatNumber ? `${row}${seatNumber}` : seatId;
    } else if (/^[A-Za-z]+[- ]?\d+$/.test(label)) {
      label = label.replace('-', '');
    }

    const dummySeat: Seat = s || {
      id: seatId,
      eventId: currentEvent?.id || '',
      blockId: block,
      rowId: row,
      seatNumber: Number(seatNumber) || 0,
      seatLabel: label,
      status: 'available',
      price: 100,
    };

    const tt = getTicketTypeForSeat(dummySeat) || selectedTier;
    const price = tt && Number(tt.price) > 0 ? Number(tt.price) : Number(dummySeat.price) || Number(selectedTier?.price) || 100;

    return {
      id: seatId,
      block: block || 'A',
      row,
      seatNumber,
      label,
      price,
      ticketType: tt,
    };
  };

  const counterSeatObjs = counterSeats.map((id) => findSeatObj(id)).filter(Boolean) as Seat[];
  const seatType = counterSeatObjs.length > 0 ? getTicketTypeForSeat(counterSeatObjs[0]) : (counterSeats.length > 0 ? getSeatInfo(counterSeats[0]).ticketType : undefined);
  const pricingType = seatType || selectedTier;

  const seatPriceTotal = counterSeats.reduce((sum, sId) => sum + getSeatInfo(sId).price, 0);
  const unitPrice =
    counterSeats.length > 0
      ? effQuantity > 0
        ? Math.round((seatPriceTotal / effQuantity) * 100) / 100
        : tierUnitPrice
      : tierUnitPrice;
  const totalAmount = counterSeats.length > 0 ? seatPriceTotal : tierUnitPrice * effQuantity;
  const assignedGate = pricingType?.gateAccess?.[0] || selectedTier?.gateAccess?.[0] || 'Gate C';
  const tierBlocks: string[] = pricingType?.blocks ?? [];
  const blockLabel = tierBlocks.includes('All') || tierBlocks.includes('ALL')
    ? 'All Blocks'
    : tierBlocks.length > 0
      ? tierBlocks.join(', ')
      : '—';

  // Category-wise breakdown: seats grouped by their owning ticket type,
  // or tier × quantity when selling without seat selection.
  interface BreakdownRow {
    name: string;
    color?: string;
    count: number;
    price: number;
    subtotal: number;
  }
  const breakdown: BreakdownRow[] = (() => {
    if (counterSeats.length > 0) {
      const map = new Map<string, BreakdownRow>();
      counterSeats.forEach((seatId) => {
        const info = getSeatInfo(seatId);
        const name = info.ticketType?.name || 'Standard';
        const color = info.ticketType?.color;
        const price = info.price;
        const row = map.get(name) || { name, color, count: 0, price, subtotal: 0 };
        row.count += 1;
        row.subtotal += price;
        map.set(name, row);
      });
      return Array.from(map.values());
    }
    return selectedTier
      ? [{ name: selectedTier.name, color: selectedTier.color, count: effQuantity, price: tierUnitPrice, subtotal: totalAmount }]
      : [];
  })();

  const handleSubmit = async (e: React.FormEvent, shouldPrint: boolean = false) => {
    e.preventDefault();
    if (saving) return;
    if (isCounterSeatMode && counterSeats.length === 0) {
      setError('Please select at least one seat to proceed');
      return;
    }
    if (!customerName.trim()) {
      setError('Please enter customer name');
      return;
    }
    if (customerPhone.trim() && !/^[0-9+\-\s]{10,15}$/.test(customerPhone.trim())) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    // Strict selling channel validation: seats in Online-active blocks CANNOT be sold at Counter
    if (isCounterSeatMode && counterSeats.length > 0) {
      const onlineSeats = counterSeats.filter((sId) => {
        const info = getSeatInfo(sId);
        return channelLabels[info.block] === 'Online';
      });
      if (onlineSeats.length > 0) {
        const badBlocks = Array.from(new Set(onlineSeats.map((sId) => getSeatInfo(sId).block))).join(', ');
        setError(`Block ${badBlocks} is active for Online selling only. Seats in this block cannot be sold at the counter.`);
        return;
      }
    } else if (selectedTier) {
      const assignedBlocks = (selectedTier.blocks || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
      const isAll = assignedBlocks.length === 0 || assignedBlocks.includes('ALL');
      if (!isAll && assignedBlocks.length > 0) {
        const allAssignedOnline = assignedBlocks.every((b) => channelLabels[b] === 'Online');
        if (allAssignedOnline) {
          setError(`Ticket category "${selectedTier.name}" belongs to block(s) ${assignedBlocks.join(', ')} active for Online selling only. Counter sales are disabled for this category.`);
          return;
        }
      }
    }

    setError('');
    setSaving(true);

    const newBooking: BookingItem = {
      id: `BK-${Date.now().toString().slice(-4)}`,
      eventId: currentEvent?.id || '',
      ticketNumber: generateBookingId(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || '+91 98000 00000',
      ticketTypeId: pricingType.id,
      ticketTypeName: pricingType.name,
      quantity: effQuantity,
      unitPrice,
      amount: totalAmount,
      ticketAmount: totalAmount,
      baseAmount: totalAmount,
      convenienceFee: 0,
      gstOnConvenienceFee: 0,
      platformCharge: 0,
      totalFees: 0,
      finalCustomerAmount: totalAmount,
      source: 'Counter',
      counterName: 'Booth 1 - Main Entrance',
      paymentMethod,
      time: currentEvent?.time || currentEvent?.startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: currentEvent?.date ?? new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Confirmed',
      assignedGate,
      ...(counterSeats.length > 0
        ? {
            seats: counterSeats,
            block: (counterSeatObjs[0]?.blockId || activeCounterSelection?.[0]?.block || '').toUpperCase(),
            seatCount: counterSeats.length,
          }
        : {})
    };

    try {
      await onAddBooking(
        newBooking,
        activeCounterSelection && activeCounterSelection.length ? activeCounterSelection : undefined
      );
    } catch (err) {
      console.error('Counter booking failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save booking. Please try again.');
      setSaving(false);
      return;
    }

    confetti({ particleCount: 40, spread: 50 });

    if (shouldPrint) {
      onPrintDirect(newBooking);
    }

    onBooked?.();
    setCustomerName('');
    setCustomerPhone('');
    setQuantity(1);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[560px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96vh] text-slate-800">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Ticket className="w-4 h-4 -rotate-45" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">NEW BOOKING</h2>
              <p className="text-[11px] font-semibold text-slate-400">{currentEvent?.title ?? 'No event selected'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-4 sm:p-5 space-y-6 flex-1 overflow-y-auto">
          {/* STEP 1 */}
          {isCounterSeatMode ? (
            /* COUNTER SEAT SELECTION MODE — Clean seat buttons [A1] [A2] [A3]..., no tier cards, no stage layout */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepHeading number={1} title="Selected Seats" />
                <span className="text-[11px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  {counterSeats.length} seat{counterSeats.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border border-purple-200/80 bg-purple-50/40 space-y-3">
                {/* Tier summary & Gate info */}
                <div className="flex items-center justify-between pb-2.5 border-b border-purple-100">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: pricingType?.color || '#7c3aed' }}
                    />
                    <span className="text-xs font-black text-slate-900">
                      {pricingType?.name || 'Standard'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      • ₹{unitPrice} / seat
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-white border border-purple-200 px-2 py-0.5 rounded-lg shadow-2xs">
                    {assignedGate}
                  </span>
                </div>

                {/* Blocks & Seat Buttons */}
                {activeCounterSelection && activeCounterSelection.length > 0 ? (
                  <div className="space-y-3">
                    {activeCounterSelection.map((group) => {
                      const blockName = (group.block || '').toUpperCase();
                      const isOnlineLocked = channelLabels[blockName] === 'Online';
                      return (
                        <div key={blockName} className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isOnlineLocked
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'text-purple-800 bg-purple-100/90 border-purple-200'
                            }`}>
                              Block {blockName}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {group.seats.length} seat{group.seats.length !== 1 ? 's' : ''}
                            </span>
                            {isOnlineLocked && (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                Online Only (Counter Disabled)
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {group.seats.map((seatId) => {
                              const info = getSeatInfo(seatId, group.block);
                              const isSeatOnline = channelLabels[info.block] === 'Online';
                              return (
                                <div
                                  key={seatId}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 shadow-xs transition-all group ${
                                    isSeatOnline
                                      ? 'border-rose-400 bg-rose-50 text-rose-900'
                                      : 'border-purple-300 bg-white hover:bg-purple-50'
                                  }`}
                                  title={
                                    isSeatOnline
                                      ? `Block ${info.block} is active for Online selling only (Cannot be sold at counter)`
                                      : `Block ${info.block} • Seat ${info.label} • ₹${info.price}`
                                  }
                                >
                                  <Armchair className={`w-3.5 h-3.5 flex-shrink-0 ${isSeatOnline ? 'text-rose-600' : 'text-purple-600'}`} />
                                  <span className={`font-black text-xs tracking-tight font-mono ${isSeatOnline ? 'text-rose-950' : 'text-purple-950'}`}>
                                    [{info.label}]
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                    isSeatOnline
                                      ? 'text-rose-700 bg-rose-100 border-rose-300'
                                      : 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
                                  }`}>
                                    ₹{info.price}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSeat(seatId)}
                                    className="w-4 h-4 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors ml-0.5"
                                    title={`Remove seat ${info.label}`}
                                    aria-label={`Remove seat ${info.label}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-rose-500 py-1">
                    No seats selected. Please close this popup and select seats from the counter grid.
                  </p>
                )}

                {/* Total row */}
                <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Selected seats total:</span>
                  <span className="text-slate-900 font-black">{formatINR(totalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            /* REGULAR BOOKING MODE — Ticket type cards, quantity spinner, stage diagram */
            <div className="space-y-3">
              <StepHeading number={1} title="Ticket & Quantity" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ticketTypes.map((tier) => {
                  const isSelected = selectedTypeId === tier.id;
                  return (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => setSelectedTypeId(tier.id)}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/60 text-purple-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }}></span>
                        <span className="text-xs font-black truncate">{tier.name}</span>
                      </div>
                      <div className="text-sm font-black mt-1 text-slate-900">₹{tier.price}</div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl border border-purple-100 bg-purple-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900 tracking-wide">{selectedTier?.name}</p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      ₹{unitPrice} per ticket &bull; {assignedGate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-black text-slate-900">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stage Layout Diagram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">Stage Layout</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                    {selectedTier?.name}: {blockLabel}
                  </span>
                </div>
                <StageDiagram
                  highlightBlocks={tierBlocks}
                  gradientIdPrefix="nbStage"
                  labels={blockLabels}
                  channelLabels={channelLabels}
                  seatStats={seatStats}
                  disabledBlocks={disabledBlocks}
                />
              </div>
            </div>
          )}

          {/* STEP 2 — YOUR DETAILS */}
          <div className="space-y-3">
            <StepHeading number={2} title="Your Details" />

            <div className="space-y-2">
              <div>
                <label htmlFor="bk-customer-name" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="bk-customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer full name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="bk-customer-phone" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="bk-customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              {error && (
                <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* STEP 3 — PAYMENT METHOD */}
          <div className="space-y-3">
            <StepHeading number={3} title="Payment Method" />

            <div className="space-y-2">
              {PAYMENT_METHODS.map((opt) => {
                const isSelected = paymentMethod === opt.key;
                return (
                  <label
                    key={opt.key}
                    onClick={() => setPaymentMethod(opt.key)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <opt.Icon className={`w-4 h-4 ${isSelected ? 'text-purple-700' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-black text-slate-900 leading-tight">{opt.title}</p>
                        <p className="text-[9px] font-medium text-slate-500">{opt.desc}</p>
                      </div>
                    </div>
                    <input type="radio" name="payment-method" checked={isSelected} readOnly className="accent-purple-600" />
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 4 — PAYMENT BREAKDOWN */}
          <div className="space-y-3">
            <StepHeading number={4} title="Payment Breakdown" />

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
              <div className="space-y-2 text-xs">
                {breakdown.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.color || '#4f39f6' }}
                      />
                      {row.name} &times; {row.count} @ ₹{row.price.toFixed(2)}
                    </span>
                    <span className="font-bold text-slate-900">₹{row.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-slate-600 font-medium border-t border-slate-200 pt-2">
                  <span>Ticket Amount ({effQuantity} ticket{effQuantity !== 1 ? 's' : ''})</span>
                  <span className="font-bold text-slate-900">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Convenience Fee</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>GST on Convenience Fee</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Platform Charge</span>
                  <span className="font-semibold text-slate-800">₹0.00</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block leading-tight">Total Amount to Collect</span>
                  <span className="text-[9px] text-slate-400 font-semibold">Counter booking &bull; no extra charges</span>
                </div>
                <span className="text-base font-black text-emerald-600">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </form>

        {/* BOTTOM CTA STRIP */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 space-y-2.5">
          <button
            type="button"
            disabled={saving || (isCounterSeatMode && counterSeats.length === 0)}
            onClick={(e) => handleSubmit(e, true)}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-60 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <Printer className="w-4 h-4" />
            <span>{saving ? 'Booking…' : <>Book & Print Slip &bull; {formatINR(totalAmount)}</>}</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            disabled={saving || (isCounterSeatMode && counterSeats.length === 0)}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent, false)}
            className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
          >
            {saving ? 'Booking…' : 'Save Booking'}
          </button>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Counter booking is 100% secure.</span>
            </div>
            <div className="flex items-center gap-1">
              <Headphones className="w-3 h-3" />
              <span>
                Need Help? <span className="text-purple-700 font-bold">Contact Support</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
