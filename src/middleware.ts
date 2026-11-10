import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && !token.revoked,
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
