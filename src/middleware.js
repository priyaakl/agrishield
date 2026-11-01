// First line of defence for pages: must be logged in, and the right role for
// /admin and /inspector. Every API route ALSO checks the role itself.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

const PUBLIC = ['/login', '/register'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (pathname.startsWith('/inspector') && !['INSPECTOR', 'ADMIN'].includes(session.role)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

// Pages only; API routes do their own checks and return JSON errors.
export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };
