import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it, vi } from "vitest";
import type { ExerciseRecord } from "@/lib/exercise/load";
import { generateReport } from "@/lib/llm";
import { generateReportWith } from "@/lib/llm/generate-report";
import { LlmCallError, type LlmCompletion, type LlmProvider } from "@/lib/llm/types";
import { buildReportFacts, reportFactsToPromptText, templateNarrative } from "@/lib/report/build";
import { toCsv } from "@/lib/report/csv";
import { dueState, nextTestDue } from "@/lib/report/due";
import { canonicalJson, contentFingerprint, sha256Hex } from "@/lib/report/hash";
import {
  reportContentSchema,
  reportNarrativeOutputSchema,
  reportNarrativeSchema,
} from "@/lib/schemas/report";
import { scenarioSchema } from "@/lib/schemas/scenario";
import reportFixture from "../fixtures/llm/report.json";
import scenarioFixture from "../fixtures/llm/scenario-ransomware.json";

const scenario = scenarioSchema.parse(scenarioFixture);

const exercise: ExerciseRecord = {
  id: "ex-1",
  org_id: "org-1",
  title: "Q4 ransomware drill",
  status: "ended",
  scheduled_at: null,
  started_at: "2026-10-15T14:00:00.000Z",
  ended_at: "2026-10-15T14:42:00.000Z",
  created_at: "2026-10-15T13:00:00.000Z",
  revealed_count: 4,
  reveal_times: [
    "2026-10-15T14:01:00.000Z",
    "2026-10-15T14:12:00.000Z",
    "2026-10-15T14:25:00.000Z",
    "2026-10-15T14:36:00.000Z",
  ],
  parking_lot: "Does the 48-hour clock start at discovery?",
  facilitator_id: "user-1",
  scenario: { id: "sc-1", type: "ransomware", is_pack: false, content: scenario },
  plan: { id: "plan-1", version: 2, status: "approved" },
  participants: [
    {
      id: "p1",
      name: "Pat Lee",
      email: null,
      role: "CEO",
      token: "t".repeat(43),
      attended_at: "2026-10-15T13:58:00.000Z",
      signed_off_at: "2026-10-15T14:45:00.000Z",
      signature_name: "Pat Lee",
    },
    {
      id: "p2",
      name: "Sam Ng",
      email: null,
      role: "IT Manager",
      token: "u".repeat(43),
      attended_at: null,
      signed_off_at: null,
      signature_name: null,
    },
  ],
  decisions: [
    {
      id: "d2",
      inject_index: 1,
      logged_at: "2026-10-15T14:15:00.000Z",
      actor_name: "Team",
      decision: "Call the insurer",
      notes: "",
    },
    {
      id: "d1",
      inject_index: 0,
      logged_at: "2026-10-15T14:03:00.000Z",
      actor_name: "Pat Lee",
      decision: "Declare SEV1",
      notes: "Scribe assigned",
    },
  ],
  findings: [
    {
      id: "f1",
      kind: "strength",
      description: "Fast declaration",
      severity: null,
      owner_name: null,
      due_date: null,
      created_at: "2026-10-15T14:05:00.000Z",
    },
    {
      id: "f2",
      kind: "gap",
      description: "No restore test",
      severity: "high",
      owner_name: null,
      due_date: null,
      created_at: "2026-10-15T14:30:00.000Z",
    },
    {
      id: "f3",
      kind: "action_item",
      description: "Run a restore test",
      severity: null,
      owner_name: "IT Manager",
      due_date: "2026-11-15",
      created_at: "2026-10-15T14:40:00.000Z",
    },
  ],
};
const org = { name: "Alpha Clinic", timezone: "America/New_York", frameworks: ["hipaa", "soc2"] };

describe("report facts", () => {
  const facts = buildReportFacts(org, exercise, "founder@example.test");

  it("assembles cover, roster, injects used, timeline and findings from the exercise", () => {
    expect(facts.cover).toMatchObject({
      org_name: "Alpha Clinic",
      scenario_type: "Ransomware",
      scenario_from_plan: true,
      duration_minutes: 42,
      plan_version: 2,
      plan_status: "approved",
      frameworks: ["HIPAA", "SOC 2"],
    });
    expect(facts.participants).toHaveLength(2);
    expect(facts.injects_used).toHaveLength(4);
    expect(facts.injects_used[3].revealed_at).toBe("2026-10-15T14:36:00.000Z");
    expect(facts.timeline.map((t) => t.decision)).toEqual(["Call the insurer", "Declare SEV1"]);
    expect(facts.strengths).toHaveLength(1);
    expect(facts.gaps[0]).toEqual({ description: "No restore test", severity: "high" });
    expect(facts.action_items[0]).toMatchObject({
      owner_name: "IT Manager",
      due_date: "2026-11-15",
    });
  });

  it("maps controls from the revealed injects only, without duplicates", () => {
    const expected = new Set(scenario.injects.slice(0, 4).flatMap((i) => i.framework_refs));
    expect(new Set(facts.control_mapping.map((c) => c.ref))).toEqual(expected);
    expect(facts.control_mapping.length).toBe(expected.size);
  });

  it("puts every fact into the prompt text and keeps names out of the narrative rules", () => {
    const text = reportFactsToPromptText(facts);
    for (const s of [
      "Alpha Clinic",
      "Q4 ransomware drill",
      "42 minutes",
      "Pat Lee, CEO: attended",
      "Sam Ng, IT Manager: did not attend",
      "Declare SEV1",
      "No restore test",
      "Run a restore test",
      "48-hour clock",
    ]) {
      expect(text).toContain(s);
    }
  });

  it("builds a valid, flagged template narrative and a valid full content object", () => {
    const narrative = templateNarrative(facts);
    expect(reportNarrativeSchema.safeParse(narrative).success).toBe(true);
    expect(narrative.origin).toBe("template");
    expect(narrative.executive_summary).toContain("1 of 2 invited participants attended");
    expect(reportContentSchema.safeParse({ ...facts, narrative }).success).toBe(true);
  });
});

describe("report narrative generation", () => {
  const facts = buildReportFacts(org, exercise, "founder@example.test");

  it("the fixture passes the output schema, which converts to JSON schema", () => {
    expect(reportNarrativeOutputSchema.safeParse(reportFixture).success).toBe(true);
    expect(zodOutputFormat(reportNarrativeOutputSchema).type).toBe("json_schema");
  });

  it("the mock provider returns the fixture through the shared pipeline", async () => {
    const { narrative, meta } = await generateReport(facts);
    expect(narrative.origin).toBe("model");
    expect(narrative.executive_summary).toBe(reportFixture.executive_summary);
    expect(meta).toMatchObject({ model: "mock", attempts: 1, fallback_used: false });
  });

  it("retries once, then falls back to the template on an API error", async () => {
    const quiet = vi.spyOn(console, "warn").mockImplementation(() => {});
    const quietError = vi.spyOn(console, "error").mockImplementation(() => {});
    const completion = (text: string): LlmCompletion => ({
      text,
      model: "stub",
      usage: { input_tokens: 10, output_tokens: 5 },
      truncated: false,
    });
    const complete = vi
      .fn()
      .mockResolvedValueOnce(completion("nope"))
      .mockResolvedValueOnce(completion(JSON.stringify(reportFixture)));
    const provider: LlmProvider = { name: "anthropic", model: "stub", complete };
    const ok = await generateReportWith(provider, facts);
    expect(ok.narrative.origin).toBe("model");
    expect(ok.meta.attempts).toBe(2);

    const failing: LlmProvider = {
      name: "anthropic",
      model: "stub",
      complete: vi.fn().mockRejectedValue(new LlmCallError("down", 503)),
    };
    const fallback = await generateReportWith(failing, facts);
    expect(fallback.narrative.origin).toBe("template");
    expect(fallback.meta).toMatchObject({
      fallback_used: true,
      fallback_reason: "api_error",
      error_status: 503,
    });
    quiet.mockRestore();
    quietError.mockRestore();
  });
});

describe("hash, due dates and CSV", () => {
  it("hashes like sha256sum and fingerprints content independent of key order", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(contentFingerprint({ b: 1, a: 2 })).toBe(contentFingerprint({ a: 2, b: 1 }));
  });

  it("puts the next test 12 months after the last ended exercise and flags the state", () => {
    expect(nextTestDue(null)).toBeNull();
    expect(nextTestDue("2026-10-15T14:42:00.000Z")?.toISOString()).toBe("2027-10-15T14:42:00.000Z");
    expect(dueState(null)).toBe("never_tested");
    expect(dueState("2026-10-15T14:42:00.000Z", new Date("2027-01-01T00:00:00.000Z"))).toBe("ok");
    expect(dueState("2026-10-15T14:42:00.000Z", new Date("2027-09-01T00:00:00.000Z"))).toBe(
      "due_soon",
    );
    expect(dueState("2026-10-15T14:42:00.000Z", new Date("2027-11-01T00:00:00.000Z"))).toBe(
      "overdue",
    );
  });

  it("writes RFC 4180 CSV", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["plain", 'say "hi", twice'],
        [null, "line\nbreak"],
      ],
    );
    expect(csv).toBe('a,b\r\nplain,"say ""hi"", twice"\r\n,"line\nbreak"\r\n');
  });
});
