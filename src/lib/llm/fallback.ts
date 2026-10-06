import { describeCompany, type GeneratorInput } from "@/lib/schemas/generator";
import type { Scenario } from "@/lib/schemas/scenario";
import { SEEDED_PACKS, VARIANT_PROFILES, type SeededPack } from "./packs";

function matchScore(pack: SeededPack, input: GeneratorInput): number {
  const profile = VARIANT_PROFILES[pack.variant];
  const hostingMatches = input.hosting.filter((option) => profile.hosting.includes(option)).length;
  const industryMatch = profile.industries.includes(input.industry) ? 1 : 0;
  // Industry outweighs a single hosting match: obligations differ more than tooling does.
  return hostingMatches * 2 + industryMatch * 3;
}

/** The seeded variant of the requested type that is closest to the visitor's company. */
export function pickSeededPack(input: GeneratorInput): SeededPack {
  const candidates = SEEDED_PACKS.filter((pack) => pack.type === input.scenarioType);
  const best = candidates.reduce<SeededPack | undefined>(
    (current, pack) =>
      current && matchScore(current, input) >= matchScore(pack, input) ? current : pack,
    undefined,
  );
  if (!best) throw new Error(`No seeded pack for scenario type "${input.scenarioType}"`);
  return best;
}

/**
 * A seeded scenario with light personalization (SPEC.md section 5): the closest
 * variant, with the company profile rewritten from what the visitor entered.
 */
export function pickSeededScenario(input: GeneratorInput): Scenario {
  const { scenario } = pickSeededPack(input);
  return {
    ...scenario,
    setting: { ...scenario.setting, company_profile: describeCompany(input) },
  };
}
