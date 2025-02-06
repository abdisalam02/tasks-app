// app/api/tasks/new/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { description, category } = await request.json();

    // In a production app, you would also include the user’s ID (created_by) from the session.
    const { data, error } = await supabase.from('Tasks').insert([
      { description, category }
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
