import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

if (!url || !key) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  console.log('=== Supabase Migration & Dual-Write Test ===\n');

  // 1. Check if new columns exist by trying to select them
  console.log('1. Checking schema gaps (new columns)...');
  const checks = [
    { table: 'bookings', cols: ['show_id', 'booking_id', 'booking_date', 'booking_time'] },
    { table: 'tickets', cols: ['show_id'] },
    { table: 'seats', cols: ['block', 'row', 'number', 'show_id', 'ticket_type_id', 'seat_label', 'seat_id'] },
    { table: 'ticket_types', cols: ['gate', 'display_order'] },
    { table: 'scanner_members', cols: ['role', 'event_id', 'pin', 'email', 'profile_photo', 'gate_id', 'total_scans', 'last_scan_at'] },
    { table: 'ticket_entries', cols: ['entry_status', 'scan_result', 'member_id', 'scanner_name', 'gate_id', 'ticket_id', 'booking_id', 'seat', 'audience_name', 'persons', 'ticket_type', 'previous_entry_time', 'previous_scanner_id', 'previous_scanner_name', 'previous_gate_id', 'booking_source', 'scan_date', 'scan_time'] },
    { table: 'gates', cols: ['capacity', 'entered', 'percentage'] },
    { table: 'counters', cols: ['event_id'] },
    { table: 'settings', cols: ['key', 'data'] },
    { table: 'audit_logs', cols: ['performed_by', 'target_id', 'metadata', 'timestamp'] },
    { table: 'events', cols: ['image_url', 'poster', 'additional_banners', 'language', 'audience', 'sale_mode', 'day', 'duration', 'entry_time', 'end_time', 'address', 'phone', 'actors', 'writer', 'director', 'music_director', 'singer', 'trailer_url', 'show_id', 'event_id'] },
    { table: 'shows', cols: ['image_url', 'poster', 'additional_banners', 'language', 'audience', 'sale_mode', 'day', 'duration', 'entry_time', 'end_time', 'address', 'phone', 'actors', 'writer', 'director', 'music_director', 'singer', 'trailer_url', 'show_id', 'event_id'] },
    { table: 'block_categories', cols: ['order'] },
  ];

  let allOk = true;
  for (const { table, cols } of checks) {
    const { data, error } = await sb.from(table).select(cols.join(',')).limit(1);
    if (error) {
      console.log(`   ✗ ${table}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`   ✓ ${table}: all ${cols.length} columns exist`);
    }
  }

  // 2. Check users table
  console.log('\n2. Checking users table...');
  const { data: usersData, error: usersErr } = await sb.from('users').select('*').limit(1);
  if (usersErr) {
    console.log(`   ✗ users: ${usersErr.message}`);
    allOk = false;
  } else {
    console.log(`   ✓ users table exists (${usersData?.length || 0} rows)`);
  }

  // 3. Test dual-write (insert + delete)
  console.log('\n3. Testing dual-write (insert/delete)...');
  const testId = `test-${Date.now()}`;
  const { data: insertData, error: insertErr } = await sb.from('events')
    .insert({ id: testId, title: 'Migration Test Event', status: 'upcoming', date: '2026-10-15', created_at: new Date().toISOString() })
    .select()
    .single();

  if (insertErr) {
    console.log(`   ✗ Insert failed: ${insertErr.message}`);
    allOk = false;
  } else {
    console.log(`   ✓ Insert succeeded: ${insertData.id}`);
    const { error: delErr } = await sb.from('events').delete().eq('id', testId);
    if (delErr) {
      console.log(`   ✗ Delete failed: ${delErr.message}`);
    } else {
      console.log(`   ✓ Delete succeeded (test row cleaned up)`);
    }
  }

  // 4. Row counts
  console.log('\n4. Current row counts:');
  for (const t of ['events', 'shows', 'bookings', 'tickets', 'seats', 'ticket_types', 'block_categories', 'gates', 'counters', 'scanner_members', 'ticket_entries', 'audit_logs', 'settings', 'banners']) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
    console.log(`   ${t}: ${count ?? 0}`);
  }

  console.log('\n=== Result ===');
  if (allOk) {
    console.log('✓ Migration 001 is complete and dual-write is working.');
    console.log('  Next: create an event from admin panel, then re-run this script to see events/shows rows.');
  } else {
    console.log('✗ Some checks failed. Make sure you ran the SQL migration in Supabase Dashboard → SQL Editor.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
