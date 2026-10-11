import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_PREFIXES = ["/account"];

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  const valid = await hasValidSession(token);
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (valid) {
    return NextResponse.next();
  }

  const response = isProtected
    ? NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url)
      )
    : NextResponse.next();

  // Signature check failed or the token expired: the cookie is stale, clear it
  // on every request (not just protected ones) so a tampered/expired session
  // doesn't linger and get re-read as "logged in" by a server component.
  if (token) {
    response.cookies.delete("session");
  }

  return response;
}

export const config = {
  // Runs on every page request except static assets and the auth API routes
  // themselves (those manage the cookie directly; letting this middleware
  // also rewrite Set-Cookie on the same response would race with them).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
