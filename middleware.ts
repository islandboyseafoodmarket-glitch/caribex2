import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.get("recovery") === "1") {
    const resetUrl = request.nextUrl.clone();
    resetUrl.pathname = "/portal/reset-password";
    resetUrl.search = "";
    return NextResponse.redirect(resetUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
