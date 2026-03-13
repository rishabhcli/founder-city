import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FounderDecisionSchema,
  ManagerDecisionSchema,
  PulseDecisionSchema,
} from "@/lib/agents/schemas";
import {
  runFounderDecision,
  runManagerDecision,
  runPulseDecision,
} from "@/lib/agents/runner";
import { createInitialCityState } from "@/lib/sim/graph";

describe("agent runner fallbacks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a schema-valid founder fallback decision when OpenAI is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const state = createInitialCityState("agent-seed", "room-2", "run-2");
    const founderDecision = await runFounderDecision(state, state.founders[0]!);

    expect(FounderDecisionSchema.parse(founderDecision)).toMatchObject({
      targetDistrict: expect.any(String),
    });
  });

  it("returns manager and pulse fallbacks that satisfy their schemas", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const state = createInitialCityState("agent-seed", "room-2", "run-2");
    const managerDecision = await runManagerDecision(state, state.managers[0]!);
    const pulseDecision = await runPulseDecision(state);

    expect(ManagerDecisionSchema.parse(managerDecision)).toMatchObject({
      department: expect.any(String),
    });
    expect(PulseDecisionSchema.parse(pulseDecision)).toMatchObject({
      headline: expect.any(String),
    });
  });
});
