import { NextResponse } from 'next/server';
import { sb } from '@/lib/supabase-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const block = String(searchParams.get('block') || '').trim().toUpperCase();

    if (!block) {
      return NextResponse.json({ success: false, error: 'Missing block parameter' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('block_categories')
      .select('id, name, online, counter, enabled')
      .eq('id', block)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: `Block "${block}" not found.` }, { status: 404 });
    }

    if (data.online === false) {
      return NextResponse.json(
        {
          success: false,
          online: false,
          error: 'This block is available for counter booking only. Please select another block.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, online: true, block: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const block = String(body.block || '').trim().toUpperCase();

    if (!block) {
      return NextResponse.json({ success: false, error: 'Missing block in request body' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('block_categories')
      .select('id, name, online, counter, enabled')
      .eq('id', block)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: `Block "${block}" not found.` }, { status: 404 });
    }

    if (data.online === false) {
      return NextResponse.json(
        {
          success: false,
          online: false,
          error: 'This block is available for counter booking only. Please select another block.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, online: true, block: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
