import type { ExerciseRecord } from "@/lib/exercise/load";
import { scenarioSchema } from "@/lib/schemas/scenario";
import scenarioFixture from "../fixtures/llm/scenario-ransomware.json";

/** An ended exercise with a roster, three decisions and three findings, for report tests. */
export const sampleOrg = {
  name: "Alpha Clinic",
  timezone: "America/New_York",
  frameworks: ["hipaa", "soc2"],
};

export const sampleExercise: ExerciseRecord = {
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
  scenario: {
    id: "sc-1",
    type: "ransomware",
    is_pack: false,
    content: scenarioSchema.parse(scenarioFixture),
  },
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
