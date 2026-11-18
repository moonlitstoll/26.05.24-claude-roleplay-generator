import { NextResponse } from 'next/server';

// Always answered by the live deployment, never from a cache: the app compares this id
// with the one it was built with to tell whether a newer version is out.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? '' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
