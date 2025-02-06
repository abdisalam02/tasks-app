// File: app/api/task/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET() {
  // First try to fetch all tasks from the Tasks table.
  const { data, error } = await supabase.from('Tasks').select('*');

  // If tasks exist, return a random one.
  if (!error && data && data.length > 0) {
    const randomTask = data[Math.floor(Math.random() * data.length)];
    return NextResponse.json(randomTask);
  }

  // Otherwise, fall back to the Bored API.
  try {
    const response = await fetch("https://www.boredapi.com/api/activity/");
    if (!response.ok) {
      return NextResponse.json(
        { error: `Bored API returned status: ${response.status}` },
        { status: response.status }
      );
    }
    const boredData = await response.json();
    if (!boredData.activity) {
      return NextResponse.json({ error: "Bored API returned no activity" }, { status: 500 });
    }
    // Map Bored API response to a task-like object.
    const randomTask = {
      description: boredData.activity,
      category: boredData.type,
      // You can add additional mappings if needed (e.g. price, participants, key, etc.)
    };
    return NextResponse.json(randomTask);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error fetching from Bored API" }, { status: 500 });
  }
}
