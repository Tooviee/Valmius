import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdminAuthorized } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { updateSession } from "@/lib/supabase/proxy-session";

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};

/**
 * Basic auth in front of /admin (Phase 1). Failed attempts count against a per-IP limit
 * so the password cannot be brute-forced.
 */
async function adminGate(request: NextRequest): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");
  const ipHash = getIpHash(request.headers);

  if (authorization) {
    // Count the attempt before checking it, so guesses are limited whether or not they succeed.
    if ((await checkRateLimit("admin_login", ipHash)) === "blocked") {
      return new NextResponse("Too many sign-in attempts from this address. Try again later.", {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (isAdminAuthorized(authorization)) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

/**
 * /app/* (Phase 2): refreshes the Supabase session and sends signed-out visitors to
 * /login. Server Functions on these pages are POSTs to the same paths, so they are
 * covered too; each one still checks the session itself (Next.js data security guide).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) return adminGate(request);

  const { response, userId } = await updateSession(request);
  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/app") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}
