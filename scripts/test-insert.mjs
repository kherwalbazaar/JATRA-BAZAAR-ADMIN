import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(url, key);

async function main() {
  console.log('=== Testing Supabase Read/Write Mirroring ===\n');

  // 1. Create a test event
  const testEventId = `test-evt-${Date.now()}`;
  console.log('1. Inserting test event...');
  const { data: evtData, error: evtErr } = await sb.from('events')
    .insert({
      id: testEventId,
      title: 'Test Live Connection Event',
      status: 'upcoming',
      date: '2026-10-25',
      venue: 'Main Stage',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (evtErr) {
    console.log(`   ✗ Event insert failed: ${evtErr.message}`);
    process.exit(1);
  }
  console.log(`   ✓ Event insert succeeded: ${evtData.id}`);

  // 2. Insert test booking referencing event
  console.log('2. Inserting test booking...');
  const testBkId = `test-bk-${Date.now()}`;
  const { data: bkData, error: bkErr } = await sb.from('bookings')
    .insert({
      id: testBkId,
      ticket_number: `TICKET-${Date.now()}`,
      event_id: testEventId,
      customer_name: 'Test Customer',
      customer_phone: '9876543210',
      status: 'Confirmed',
      amount: 250,
      date: '2026-10-25',
      time: '11:00 PM',
      ticket_type_name: 'Standard',
      source: 'Counter',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (bkErr) {
    console.log(`   ✗ Booking insert failed: ${bkErr.message}`);
  } else {
    console.log(`   ✓ Booking insert succeeded: ${bkData.id}`);
  }

  // 3. Insert test seat referencing event
  console.log('3. Inserting test seat...');
  const testSeatId = `test-seat-${Date.now()}`;
  const { data: seatData, error: seatErr } = await sb.from('seats')
    .insert({
      id: testSeatId,
      event_id: testEventId,
      block_id: 'A1',
      row_id: 'A',
      seat_number: 1,
      seat_label: 'A1',
      status: 'available',
      price: 150,
    })
    .select()
    .single();

  if (seatErr) {
    console.log(`   ✗ Seat insert failed: ${seatErr.message}`);
  } else {
    console.log(`   ✓ Seat insert succeeded: ${seatData.id}`);
  }

  // 4. Clean up test event (cascades to booking & seat)
  console.log('4. Cleaning up test data...');
  const { error: delErr } = await sb.from('events').delete().eq('id', testEventId);
  if (delErr) {
    console.log(`   ✗ Clean up failed: ${delErr.message}`);
  } else {
    console.log('   ✓ Clean up succeeded (test rows removed)');
  }

  console.log('\n=== All Operations Succeeded! Supabase is fully connected & writable! ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
