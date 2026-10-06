import { z } from "zod";
import { HEADCOUNT_BANDS, INDUSTRIES } from "./generator";
import { packScenarioTypeSchema } from "./scenario";

// Context fields are optional and informational: an unexpected value is dropped, not rejected.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional().catch(undefined),
  );

/** An email capture from the generator gate or the landing page. */
export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  source: z.enum(["generator", "landing"]),
  industry: optional(z.enum(INDUSTRIES)),
  headcountBand: optional(z.enum(HEADCOUNT_BANDS)),
  scenarioType: optional(packScenarioTypeSchema),
});

export type LeadInput = z.infer<typeof leadSchema>;
