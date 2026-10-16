import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Decode a JWT payload (without verifying the signature) and report whether it
 * is expired. The backend remains the source of truth for auth; this check only
 * exists so the middleware does not treat a stale cookie as a live session.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const data = JSON.parse(atob(padded));
    if (typeof data.exp !== "number") return false;
    return Date.now() >= data.exp * 1000;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith("/admin");
  const isLoginPage = path === "/admin";

  const rawToken = request.cookies.get("access_token_cookie")?.value;
  // The access cookie is a session cookie (JWT_SESSION_COOKIE) that stays in the
  // browser after the JWT expires. Without checking `exp` here, the middleware
  // bounced users away from /admin while check-auth returned 401, leaving them
  // stuck on "Session expired. Redirecting to login...".
  const isLoggedIn = Boolean(rawToken) && !isTokenExpired(rawToken as string);

  // Not logged in → block protected pages
  if (isAdminRoute && !isLoginPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Already logged in → prevent login page
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
