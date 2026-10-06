import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdminAuthorized } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";

export const config = {
  matcher: ["/admin/:path*"],
};

/**
 * Basic auth in front of /admin (Phase 1 only; real auth arrives in Phase 2).
 * Failed attempts count against a per-IP limit so the password cannot be brute-forced.
 */
export async function proxy(request: NextRequest) {
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
