import { NextResponse } from 'next/server';

// football-data.org free tier does not expose a team season statistics endpoint.
// The match analysis page handles null season stats gracefully.
export async function GET() {
  return NextResponse.json({ response: null });
}
