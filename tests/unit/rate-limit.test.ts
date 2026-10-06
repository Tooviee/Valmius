import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, RATE_LIMITS, rateLimitKey, type BumpRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/rate-limit/ip";

/**
 * In-memory stand-in for the `bump_rate_limit` SQL function in the Phase 1 migration:
 * a fixed window per key that resets once the window has passed. The real function
 * is exercised by tests/integration/rate-limit.db.test.ts.
 */
function createFakeBump() {
  const rows = new Map<string, { count: number; windowStart: number }>();
  const bump = vi.fn<BumpRateLimit>(async ({ p_key, p_limit, p_window_seconds }) => {
    const now = Date.now();
    const row = rows.get(p_key);
    if (!row || row.windowStart < now - p_window_seconds * 1000) {
      rows.set(p_key, { count: 1, windowStart: now });
    } else {
      row.count += 1;
    }
    return { data: rows.get(p_key)!.count <= p_limit, error: null };
  });
  return bump;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("rate limiter", () => {
  it("allows 5 generations in an hour and blocks the 6th", async () => {
    const bump = createFakeBump();
    const results = [];
    for (let request = 1; request <= 6; request += 1) {
      results.push(await checkRateLimit("generate", "ip-hash-1", bump));
      vi.advanceTimersByTime(5 * 60 * 1000);
    }

    expect(results).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed", "blocked"]);
  });

  it("allows requests again once the hour has passed", async () => {
    const bump = createFakeBump();
    for (let request = 1; request <= 6; request += 1) {
      await checkRateLimit("generate", "ip-hash-1", bump);
    }
    expect(await checkRateLimit("generate", "ip-hash-1", bump)).toBe("blocked");

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

    expect(await checkRateLimit("generate", "ip-hash-1", bump)).toBe("allowed");
  });

  it("counts each IP separately", async () => {
    const bump = createFakeBump();
    for (let request = 1; request <= 6; request += 1) {
      await checkRateLimit("generate", "ip-hash-1", bump);
    }

    expect(await checkRateLimit("generate", "ip-hash-2", bump)).toBe("allowed");
  });

  it("calls the RPC with the generation limit from the spec: 5 per 3600 seconds", async () => {
    const bump = createFakeBump();
    await checkRateLimit("generate", "abc123", bump);

    expect(RATE_LIMITS.generate).toMatchObject({ limit: 5, windowSeconds: 3600 });
    expect(bump).toHaveBeenCalledWith({ p_key: "gen:abc123", p_limit: 5, p_window_seconds: 3600 });
    expect(rateLimitKey("generate", "abc123")).toBe("gen:abc123");
  });

  it("keeps the limits for different endpoints apart", async () => {
    const bump = createFakeBump();
    for (let request = 1; request <= 6; request += 1) {
      await checkRateLimit("generate", "ip-hash-1", bump);
    }

    expect(await checkRateLimit("pdf", "ip-hash-1", bump)).toBe("allowed");
    expect(await checkRateLimit("lead", "ip-hash-1", bump)).toBe("allowed");
  });

  it("reports unavailable when the RPC returns an error or throws", async () => {
    const failing: BumpRateLimit = async () => ({ data: null, error: { message: "boom" } });
    const throwing: BumpRateLimit = async () => {
      throw new Error("network down");
    };

    expect(await checkRateLimit("generate", "ip-hash-1", failing)).toBe("unavailable");
    expect(await checkRateLimit("generate", "ip-hash-1", throwing)).toBe("unavailable");
  });
});

describe("IP hashing", () => {
  it("takes the first address from x-forwarded-for, then x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("produces a stable keyed hash that does not contain the IP", () => {
    vi.stubEnv("IP_HASH_SALT", "salt-one");
    const first = hashIp("203.0.113.7");

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.7");
    expect(hashIp("203.0.113.7")).toBe(first);
    expect(hashIp("203.0.113.8")).not.toBe(first);

    vi.stubEnv("IP_HASH_SALT", "salt-two");
    expect(hashIp("203.0.113.7")).not.toBe(first);
    vi.unstubAllEnvs();
  });

  it("refuses to hash without a salt", () => {
    vi.stubEnv("IP_HASH_SALT", "");
    expect(() => hashIp("203.0.113.7")).toThrow(/IP_HASH_SALT/);
    vi.unstubAllEnvs();
  });
});
