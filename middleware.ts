import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const session = request.cookies.get("iv_session")
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/api/auth/login"]
  const isPublicRoute = publicRoutes.includes(pathname)

  // If user is not logged in and trying to access protected route
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // If user is logged in and trying to access login page, redirect to dashboard
  if (session && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     * - API routes except auth
     */
    "/((?!_next/static|_next/image|favicon.ico|images|icon|apple-icon|pdffiles|api/(?!auth)).*)",
  ],
}
