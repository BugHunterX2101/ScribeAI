import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value

  if (request.nextUrl.pathname.startsWith('/dashboard') || 
      request.nextUrl.pathname.startsWith('/sessions')) {
    if (!userId) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  if (request.nextUrl.pathname.startsWith('/auth')) {
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/sessions/:path*', '/auth/:path*']
}