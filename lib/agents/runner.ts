import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/env";
import type {
  CityState,
  DistrictId,
  FounderAgentState,
  FounderDecision,
  ManagerAgentState,
  ManagerDecision,
  PulseEventDecision,
} from "@/lib/types/city";

import { buildFounderPrompt, buildManagerPrompt, buildPulsePrompt } from "./prompts";
import {
  FounderDecisionSchema,
  type FounderDecisionOutput,
  ManagerDecisionSchema,
  type ManagerDecisionOutput,
  PulseDecisionSchema,
  type PulseDecisionOutput,
} from "./schemas";

let cachedClient: OpenAI | null = null;

type FounderDecisionContext = {
  city: CityState;
  founderId?: string;
  founder?: FounderAgentState;
  citySummary?: string;
  founderNeed?: string[];
  district?: string;
  routeIndex?: number;
  runway?: number;
  elapsedMs?: number;
};

type ManagerDecisionContext = {
  city: CityState;
  managerId?: string;
  manager?: ManagerAgentState;
  citySummary?: string;
  department?: string;
  activeVotes?: number;
  elapsedMs?: number;
};

type PulseDecisionContext = {
  city: CityState;
  citySummary?: string;
  runPressure?: number;
  elapsedMs?: number;
};

function currentApiKey() {
  return process.env.OPENAI_API_KEY ?? env.openAiApiKey;
}

function currentModel() {
  return process.env.OPENAI_MODEL ?? env.openAiModel;
}

function getClient() {
  const apiKey = currentApiKey();

  if (!apiKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

function districtBySelector(
  state: CityState,
  selector: (district: CityState["districts"][DistrictId]) => number,
  descending = true,
) {
  const districts = Object.values(state.districts);
  return districts.sort((left, right) =>
    descending ? selector(right) - selector(left) : selector(left) - selector(right),
  )[0];
}

function founderFallback(
  state: CityState,
  founder: FounderAgentState,
): FounderDecisionOutput {
  if (founder.runway <= 12) {
    const targetDistrict =
      districtBySelector(
        state,
        (district) => district.stats.permits + district.stats.capital - district.stats.rentPressure,
      )?.id ?? founder.currentDistrict;

    return {
      action: "relocate",
      targetDistrict,
      priority: 92,
      speechBubble: `Relocating to ${state.districts[targetDistrict].label} before burn kills us.`,
      reason: "Runway is low and the current district can no longer support the company.",
    };
  }

  const weakestNeed = founder.needs
    .slice()
    .sort(
      (left, right) =>
        founder.resourceProgress[left] - founder.resourceProgress[right],
    )[0];

  if (founder.resourceProgress[weakestNeed] < 24) {
    const targetDistrict =
      districtBySelector(state, (district) => district.stats[weakestNeed])?.id ??
      founder.currentDistrict;

    return {
      action: founder.pivotTolerance > 0.7 ? "pivot" : "reroute",
      targetDistrict,
      priority: 78,
      speechBubble: `Need ${weakestNeed} now. Heading for ${state.districts[targetDistrict].label}.`,
      reason: `${weakestNeed} is the scarcest input, so the company should chase the district with the strongest supply.`,
    };
  }

  if (founder.needs.every((need) => founder.resourceProgress[need] >= 70)) {
    return {
      action: "breakout",
      targetDistrict: founder.currentDistrict,
      priority: 95,
      speechBubble: "We have the stack. Time to break out.",
      reason: "Core resource thresholds are met across the board.",
    };
  }

  return {
    action: "stall",
    targetDistrict: founder.currentDistrict,
    priority: 52,
    speechBubble: "Holding position until the city opens a cleaner path.",
    reason: "A short stall is safer than burning runway on a weak route.",
  };
}

function managerFallback(
  state: CityState,
  manager: ManagerAgentState,
): ManagerDecisionOutput {
  switch (manager.department) {
    case "permits": {
      const targetDistrict =
        districtBySelector(
          state,
          (district) => district.stats.compute + district.stats.capital - district.stats.permits,
        )?.id ?? manager.targetDistrict;

      return {
        department: "permits",
        recommendationType: "fast-track",
        targetDistrict,
        impact: 74,
        speechBubble: `Fast-track ${state.districts[targetDistrict].label} before the backlog kills launches.`,
        reason: "High-growth districts are bottlenecked by permit scarcity.",
      };
    }
    case "transit": {
      const targetDistrict =
        districtBySelector(state, (district) => district.stats.congestion)?.id ??
        manager.targetDistrict;

      return {
        department: "transit",
        recommendationType: "reroute",
        targetDistrict,
        impact: 71,
        speechBubble: `Transit wants a new connector through ${state.districts[targetDistrict].label}.`,
        reason: "Congestion is the clearest citywide constraint on founder movement.",
      };
    }
    case "capital": {
      const targetDistrict =
        districtBySelector(state, (district) => district.stats.capital, false)?.id ??
        manager.targetDistrict;

      return {
        department: "capital",
        recommendationType: "grant",
        targetDistrict,
        impact: 69,
        speechBubble: `Capital is dropping a pulse into ${state.districts[targetDistrict].label}.`,
        reason: "The weakest capital district needs liquidity to stay competitive.",
      };
    }
    case "community":
    default: {
      const targetDistrict =
        districtBySelector(
          state,
          (district) => district.stats.vibe + district.stats.localBusiness,
          false,
        )?.id ?? manager.targetDistrict;

      return {
        department: "community",
        recommendationType: "festival",
        targetDistrict,
        impact: 68,
        speechBubble: `Community wants to recharge ${state.districts[targetDistrict].label}.`,
        reason: "The city is losing neighborhood energy where local business is weakest.",
      };
    }
  }
}

function pulseFallback(state: CityState): PulseDecisionOutput {
  const worstCongestion =
    districtBySelector(state, (district) => district.stats.congestion)?.id ?? "soma";
  const weakestCulture =
    districtBySelector(
      state,
      (district) => district.stats.vibe + district.stats.localBusiness,
      false,
    )?.id ?? "mission";

  if (state.score.commuteHealth < 45) {
    return {
      headline: `Transit shock hits ${state.districts[worstCongestion].label}`,
      eventType: "muni-disruption",
      affectedDistricts: [worstCongestion],
      effectVector: {
        congestion: 18,
        talent: -6,
      },
      tickerCopy: "City Pulse: commute pain is cascading through the board.",
    };
  }

  return {
    headline: `${state.districts[weakestCulture].label} catches a founder dinner surge`,
    eventType: "founder-dinner",
    affectedDistricts: [weakestCulture],
    effectVector: {
      vibe: 14,
      localBusiness: 10,
      congestion: 4,
    },
    tickerCopy: "City Pulse: nightlife and customer energy just spiked in one district.",
  };
}

async function parseWithModel<T>(
  schemaName: string,
  schema:
    | typeof FounderDecisionSchema
    | typeof ManagerDecisionSchema
    | typeof PulseDecisionSchema,
  instructions: string,
  input: string,
) {
  const client = getClient();

  if (!client) {
    throw new Error("OpenAI is not configured.");
  }

  const response = await client.responses.parse(
    {
      model: currentModel(),
      instructions,
      input,
      text: {
        format: zodTextFormat(schema, schemaName),
      },
    },
    {
      signal: AbortSignal.timeout(2_000),
    },
  );

  if (!response.output_parsed) {
    throw new Error(`No parsed output for schema ${schemaName}.`);
  }

  return schema.parse(response.output_parsed) as T;
}

function findFounder(
  state: CityState,
  founderOrId: string | FounderAgentState,
) {
  if (typeof founderOrId !== "string") {
    return founderOrId;
  }

  return state.founders.find((founder) => founder.id === founderOrId);
}

function findManager(
  state: CityState,
  managerOrId?: string | ManagerAgentState,
) {
  if (!managerOrId) {
    return state.managers[0];
  }

  if (typeof managerOrId !== "string") {
    return managerOrId;
  }

  return state.managers.find(
    (manager) => manager.id === managerOrId || manager.department === managerOrId,
  );
}

function normalizeFounderArgs(
  stateOrContext: CityState | FounderDecisionContext,
  founderOrId?: string | FounderAgentState,
) {
  if ("city" in stateOrContext) {
    return {
      state: stateOrContext.city,
      founder: stateOrContext.founder ?? stateOrContext.founderId ?? founderOrId,
    };
  }

  return {
    state: stateOrContext,
    founder: founderOrId,
  };
}

function normalizeManagerArgs(
  stateOrContext: CityState | ManagerDecisionContext,
  managerOrId?: string | ManagerAgentState,
) {
  if ("city" in stateOrContext) {
    return {
      state: stateOrContext.city,
      manager: stateOrContext.manager ?? stateOrContext.managerId ?? managerOrId,
    };
  }

  return {
    state: stateOrContext,
    manager: managerOrId,
  };
}

function normalizePulseArgs(stateOrContext: CityState | PulseDecisionContext) {
  if ("city" in stateOrContext) {
    return stateOrContext.city;
  }

  return stateOrContext;
}

export async function runFounderDecision(
  stateOrContext: CityState | FounderDecisionContext,
  founderOrId?: string | FounderAgentState,
): Promise<FounderDecision> {
  const normalized = normalizeFounderArgs(stateOrContext, founderOrId);
  const founder = findFounder(
    normalized.state,
    normalized.founder ?? normalized.state.founders[0]!,
  );

  if (!founder) {
    throw new Error("Founder not found.");
  }

  const prompt = buildFounderPrompt(normalized.state, founder);

  try {
    return await parseWithModel<FounderDecisionOutput>(
      "founder_decision",
      FounderDecisionSchema,
      prompt.instructions,
      prompt.input,
    );
  } catch {
    return founderFallback(normalized.state, founder);
  }
}

export async function runManagerDecision(
  stateOrContext: CityState | ManagerDecisionContext,
  managerOrId?: string | ManagerAgentState,
): Promise<ManagerDecision> {
  const normalized = normalizeManagerArgs(stateOrContext, managerOrId);
  const manager = findManager(normalized.state, normalized.manager);

  if (!manager) {
    throw new Error("Manager not found.");
  }

  const prompt = buildManagerPrompt(normalized.state, manager);

  try {
    return await parseWithModel<ManagerDecisionOutput>(
      "manager_decision",
      ManagerDecisionSchema,
      prompt.instructions,
      prompt.input,
    );
  } catch {
    return managerFallback(normalized.state, manager);
  }
}

export async function runPulseDecision(
  stateOrContext: CityState | PulseDecisionContext,
): Promise<PulseEventDecision> {
  const state = normalizePulseArgs(stateOrContext);
  const prompt = buildPulsePrompt(state);

  try {
    return await parseWithModel<PulseDecisionOutput>(
      "pulse_decision",
      PulseDecisionSchema,
      prompt.instructions,
      prompt.input,
    );
  } catch {
    return pulseFallback(state);
  }
}

export const runPulseEventDecision = runPulseDecision;
