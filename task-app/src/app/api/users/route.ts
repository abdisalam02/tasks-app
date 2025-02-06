// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, score,username, last_active, name, avatar_url')
    .order('last_active', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
