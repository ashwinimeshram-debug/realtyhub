import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token_cookie");

  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith("/admin");
  const isLoginPage = path === "/admin";

  // Not logged in → block protected pages
  if (isAdminRoute && !isLoginPage && !token) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Already logged in → prevent login page
  if (isLoginPage && token) {
    return NextResponse.redirect(
      new URL("/admin/dashboard", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
