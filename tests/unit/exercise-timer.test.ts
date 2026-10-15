import { describe, expect, it } from "vitest";
import {
  elapsedMs,
  formatElapsed,
  formatOffset,
  injectStates,
  nextInjectDueIn,
} from "@/lib/exercise/timer";
import {
  generateParticipantToken,
  isParticipantToken,
  isParticipantTokenExpired,
  participantPath,
} from "@/lib/exercise/token";

const injects = [
  { offset_minutes: 0 },
  { offset_minutes: 15 },
  { offset_minutes: 30 },
  { offset_minutes: 50 },
];

describe("timer math", () => {
  it("measures elapsed time from the start and never goes negative", () => {
    const start = "2026-10-15T10:00:00.000Z";
    expect(elapsedMs(start, new Date("2026-10-15T10:12:30.000Z"))).toBe(750_000);
    expect(elapsedMs(start, new Date("2026-10-15T09:59:00.000Z"))).toBe(0);
  });

  it("formats minutes and seconds, adding hours only when needed", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(59_999)).toBe("00:59");
    expect(formatElapsed(750_000)).toBe("12:30");
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(5_025_000)).toBe("1:23:45");
    expect(formatOffset(0)).toBe("Start");
    expect(formatOffset(15)).toBe("+15 min");
  });

  it("marks injects as revealed, due or upcoming", () => {
    expect(injectStates(injects, 0, 0)).toEqual(["due", "upcoming", "upcoming", "upcoming"]);
    expect(injectStates(injects, 1, 16 * 60_000)).toEqual([
      "revealed",
      "due",
      "upcoming",
      "upcoming",
    ]);
    expect(injectStates(injects, 2, 16 * 60_000)).toEqual([
      "revealed",
      "revealed",
      "upcoming",
      "upcoming",
    ]);
    expect(injectStates(injects, 4, 90 * 60_000)).toEqual([
      "revealed",
      "revealed",
      "revealed",
      "revealed",
    ]);
  });

  it("counts down to the next unrevealed inject", () => {
    expect(nextInjectDueIn(injects, 1, 10 * 60_000)).toBe(5 * 60_000);
    expect(nextInjectDueIn(injects, 1, 20 * 60_000)).toBe(0);
    expect(nextInjectDueIn(injects, 4, 20 * 60_000)).toBeNull();
  });
});

describe("participant tokens", () => {
  it("are 43 base64url characters of 32 random bytes, and unique", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateParticipantToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toHaveLength(43);
      expect(isParticipantToken(token)).toBe(true);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
    }
    expect(participantPath("abc")).toBe("/x/abc");
  });

  it("rejects anything that is not a token", () => {
    expect(isParticipantToken("short")).toBe(false);
    expect(isParticipantToken("a".repeat(43) + "/")).toBe(false);
    expect(isParticipantToken("+".repeat(43))).toBe(false);
    expect(isParticipantToken(null)).toBe(false);
  });

  it("expires 30 days after the exercise ends, and never before it ends", () => {
    const ended = "2026-10-15T12:00:00.000Z";
    expect(isParticipantTokenExpired(null, new Date("2027-01-01T00:00:00.000Z"))).toBe(false);
    expect(isParticipantTokenExpired(ended, new Date("2026-11-13T12:00:00.000Z"))).toBe(false);
    expect(isParticipantTokenExpired(ended, new Date("2026-11-14T12:00:01.000Z"))).toBe(true);
  });
});
