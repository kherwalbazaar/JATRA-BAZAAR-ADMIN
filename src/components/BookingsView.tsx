'use client';

import React from 'react';
import { BookingItem } from '@/types';
import AdminBookings from './AdminBookings';

interface BookingsViewProps {
  bookings?: BookingItem[];
  currentShowId?: string;
  onOpenNewBooking?: () => void;
  onSelectBooking?: (booking: BookingItem) => void;
  onPrintTicket?: (booking: BookingItem) => void;
}

export { AdminBookings };

export default function BookingsView({
  bookings = [],
  currentShowId,
  onOpenNewBooking,
  onSelectBooking,
  onPrintTicket,
}: BookingsViewProps) {
  return (
    <AdminBookings
      currentShowId={currentShowId}
      initialBookings={bookings}
      onOpenNewBooking={onOpenNewBooking}
      onSelectBooking={onSelectBooking}
      onPrintTicket={onPrintTicket}
    />
  );
}
