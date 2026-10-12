import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(url, key);

async function probe(table, col) {
  const { error } = await sb.from(table).select(col).limit(1);
  return !error;
}

async function main() {
  // Check snake_case columns that the migration should have added
  const eventSnake = [
    'id', 'show_id', 'event_id', 'title', 'subtitle', 'date', 'day', 'time', 'venue', 'city',
    'status', 'poster', 'total_capacity', 'tickets_sold', 'total_revenue', 'organizer', 'description',
    'event_title', 'committee_name', 'committee_location', 'party_name', 'language', 'audience',
    'year', 'month', 'day_of_month', 'entry_time', 'start_time', 'event_time', 'end_time', 'duration',
    'address', 'phone', 'actors', 'additional_banners', 'writer', 'director', 'music_director',
    'singer', 'trailer_url', 'sale_mode', 'image_url', 'created_at', 'updated_at'
  ];

  console.log('=== events: snake_case columns ===');
  for (const c of eventSnake) {
    const ok = await probe('events', c);
    console.log(`  ${ok ? '✓' : '✗'} ${c}`);
  }

  console.log('\n=== shows: snake_case columns ===');
  for (const c of eventSnake) {
    const ok = await probe('shows', c);
    console.log(`  ${ok ? '✓' : '✗'} ${c}`);
  }
}
main();
