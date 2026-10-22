import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  if (!req.cookies.get('access_token')) {
    const url = req.nextUrl.clone();
    // se conserva el destino para volver tras el login (enlaces a /tasks/<id>)
    const next = pathname + req.nextUrl.search;
    url.pathname = '/login';
    url.search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
