import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    try {
      await prisma.waitlist.create({ data: { email: email.toLowerCase().trim() } });
    } catch (err: any) {
      // Unique constraint violation means email already registered.
      if (err.code === 'P2002') {
        return NextResponse.json({ message: 'Already subscribed' });
      }
      throw err;
    }

    return NextResponse.json({ message: 'Subscribed successfully' });
  } catch (err: any) {
    console.error('Waitlist route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
