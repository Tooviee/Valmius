import { describe, expect, it } from "vitest";
import {
  createExerciseSchema,
  decisionEntrySchema,
  findingInputSchema,
  participantInputSchema,
} from "@/lib/schemas/exercise";

describe("exercise schemas", () => {
  it("accepts an exercise from a pack with participants, and from the plan with a focus", () => {
    const fromPack = createExerciseSchema.safeParse({
      title: "Q4 tabletop",
      scheduledAt: "2026-11-02T15:00:00.000Z",
      source: { kind: "pack", scenarioId: "6f1d3c0e-8b7a-4e59-9a54-2d1c7e0b5a11" },
      participants: [
        { name: "Pat Lee", email: "pat@example.com", role: "CEO" },
        { name: "Sam Ng", email: "", role: "IT Manager" },
      ],
    });
    expect(fromPack.success).toBe(true);
    expect(fromPack.data?.participants[1].email).toBeUndefined();

    const generated = createExerciseSchema.safeParse({
      title: "Ransomware drill",
      source: {
        kind: "generate",
        scenarioType: "ransomware",
        focus: "Focus on the warehouse server.",
      },
      participants: [],
    });
    expect(generated.success).toBe(true);
  });

  it("rejects more than twelve participants, a bad email and an unknown source", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ name: `P${i}`, role: "Staff" }));
    expect(
      createExerciseSchema.safeParse({
        title: "x",
        source: { kind: "generate", scenarioType: "bec" },
        participants: many,
      }).success,
    ).toBe(false);
    expect(
      participantInputSchema.safeParse({ name: "A", email: "not-an-email", role: "B" }).success,
    ).toBe(false);
    expect(
      createExerciseSchema.safeParse({ title: "x", source: { kind: "upload" }, participants: [] })
        .success,
    ).toBe(false);
  });

  it("validates decisions and findings", () => {
    expect(
      decisionEntrySchema.safeParse({
        injectIndex: 0,
        actorName: "Team",
        decision: "Isolate the server.",
      }).success,
    ).toBe(true);
    expect(
      decisionEntrySchema.safeParse({ injectIndex: null, actorName: "", decision: "x" }).success,
    ).toBe(false);

    expect(
      findingInputSchema.safeParse({ kind: "strength", description: "Fast escalation." }).success,
    ).toBe(true);
    const gapWithoutSeverity = findingInputSchema.safeParse({
      kind: "gap",
      description: "No backups tested.",
    });
    expect(gapWithoutSeverity.success).toBe(false);
    expect(gapWithoutSeverity.error?.issues[0]?.path).toEqual(["severity"]);
    expect(
      findingInputSchema.safeParse({
        kind: "action_item",
        description: "Test a restore.",
        ownerName: "IT Manager",
        dueDate: "2026-12-01",
      }).success,
    ).toBe(true);
  });
});
