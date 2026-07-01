import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('waitlist')
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Unique constraint violation means email already registered
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Already subscribed' });
      }
      console.error('Waitlist insert error:', error);
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Waitlist route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
