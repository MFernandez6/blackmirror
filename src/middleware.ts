import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/login") || path.startsWith("/offline")) return true;
        if (path === "/sw.js" || path.startsWith("/icons") || path === "/manifest.webmanifest") {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/inspections/:path*",
    "/api/inspections/:path*",
    "/api/claims/:path*",
    "/api/analyze-photo",
  ],
};
