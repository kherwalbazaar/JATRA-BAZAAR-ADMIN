import { createClient } from '@supabase/supabase-js';

const sbUrl = 'https://fmiaiuhmmlyciafxgvna.supabase.co';
const sbKey = 'sb_publishable_3CszK-oOtR0ce83iCNU30g_-ZuSt8or';
const sb = createClient(sbUrl, sbKey);

console.log('--- TEST 1: Supabase Bookings Query for Event wWpPHoS1Hb83ODSY5nBf ---');
const { data: bData, error: bErr } = await sb
  .from('bookings')
  .select('*')
  .or('event_id.eq.wWpPHoS1Hb83ODSY5nBf,show_id.eq.wWpPHoS1Hb83ODSY5nBf')
  .order('created_at', { ascending: false });

if (bErr) {
  console.error('Bookings query failed:', bErr);
} else {
  console.log(`Found ${bData.length} bookings for this event.`);
  for (const b of bData) {
    console.log(`- [${b.ticket_number}] ${b.customer_name} | Seats: ${JSON.stringify(b.seats)} | Amount: ₹${b.amount} | Status: ${b.status}`);
  }
}

console.log('\n--- TEST 2: Supabase Booked Seats for Event wWpPHoS1Hb83ODSY5nBf ---');
const { data: sData, error: sErr } = await sb
  .from('seats')
  .select('id, seat_id, block_id, row_id, seat_number, status, booking_id')
  .eq('event_id', 'wWpPHoS1Hb83ODSY5nBf')
  .eq('status', 'booked')
  .order('seat_number');

if (sErr) {
  console.error('Seats query failed:', sErr);
} else {
  console.log(`Found ${sData.length} booked seats for this event:`);
  for (const s of sData) {
    console.log(`- Seat ${s.seat_id || s.id} (${s.block_id}-${s.row_id}-${s.seat_number}) -> booked by ${s.booking_id}`);
  }
}

console.log('\n--- TEST 3: Tickets for NJ26-00021 ---');
const { data: tData, error: tErr } = await sb
  .from('tickets')
  .select('*')
  .or('booking_id.eq.NJ26-00021,booking_doc_id.eq.NJ26-00021');

if (tErr) {
  console.error('Tickets query failed:', tErr);
} else {
  console.log(`Found ${tData.length} tickets:`);
  for (const t of tData) {
    console.log(`- Ticket ${t.ticket_id || t.id} | Seat: ${t.seat} | Status: ${t.status}`);
  }
}
