import type {
  CityState,
  DistrictId,
  DistrictState,
  EventCard,
  FounderAgentState,
  Intervention,
  ResourceVector,
  RunSummary,
  VoteOption,
  VoteRound,
} from "@/lib/types/city";
import { average, clamp } from "@/lib/utils";

import { materializeEventCard } from "./events";
import {
  AGENT_TICK_INTERVAL_MS,
  DISTRICT_BY_ID,
  EVENT_INTERVAL_MS,
  RUN_DURATION_MS,
  SIM_TICK_MS,
  VOTE_INTERVAL_MS,
  VOTE_WINDOW_MS,
  chooseFounderTarget,
  findShortestPath,
  inferCompanyType,
} from "./graph";
import { advancePlayerStartups, buildPlayerStartupOutcomes } from "./player-startups";
import { createSeededRandom, randomId, shuffle } from "./random";
import { deriveScore } from "./scoring";

export const CITY_DURATION_MS = RUN_DURATION_MS;
export const CITY_TICK_MS = SIM_TICK_MS;

function cloneState(state: CityState): CityState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }

  return JSON.parse(JSON.stringify(state)) as CityState;
}

function appendTicker(state: CityState, message: string) {
  state.ticker = [message, ...state.ticker].slice(0, 6);
}

function applyEffect(
  district: DistrictState,
  effect: Partial<ResourceVector>,
  intensity = 1,
) {
  for (const [key, value] of Object.entries(effect) as Array<
    [keyof ResourceVector, number]
  >) {
    district.stats[key] = clamp(district.stats[key] + value * intensity, 0, 100);
  }
}

function needsCompletion(founder: FounderAgentState) {
  return founder.needs.filter((need) => founder.resourceProgress[need] >= 70).length;
}

function founderAverageProgress(founder: FounderAgentState) {
  return average(founder.needs.map((need) => founder.resourceProgress[need]));
}

function updateFounderStatus(founder: FounderAgentState) {
  if (founder.runway <= 0) {
    return "dead";
  }

  if (
    needsCompletion(founder) >= Math.max(3, founder.needs.length - 1) &&
    founderAverageProgress(founder) >= 72
  ) {
    return "breakout";
  }

  if (founder.runway < 18 && founderAverageProgress(founder) < 45) {
    return "stalled";
  }

  if (founder.currentDistrict !== founder.targetDistrict) {
    return "relocating";
  }

  if (founder.status === "pivoted") {
    return "pivoted";
  }

  return "active";
}

function harvestDistrict(founder: FounderAgentState, district: DistrictState) {
  founder.influencedBy = [...new Set([...founder.influencedBy, district.id])];

  for (const need of founder.needs) {
    const gain = district.stats[need] * 0.08;
    founder.resourceProgress[need] = clamp(founder.resourceProgress[need] + gain, 0, 100);
  }

  founder.companyType = inferCompanyType(founder);
}

function setFounderTarget(
  founder: FounderAgentState,
  districts: Record<DistrictId, DistrictState>,
  seed: string,
) {
  const nextTarget = chooseFounderTarget(founder, districts, seed);

  if (nextTarget === founder.currentDistrict) {
    founder.targetDistrict = nextTarget;
    founder.route = [founder.currentDistrict];
    founder.routeIndex = 0;
    founder.routeProgress = 0;
    return;
  }

  const nextRoute = findShortestPath(founder.currentDistrict, nextTarget);
  const nextCompanyType = inferCompanyType({
    ...founder,
    influencedBy: [...new Set([...founder.influencedBy, nextTarget])],
  });

  if (nextCompanyType !== founder.companyType && founder.pivotTolerance > 0.55) {
    founder.status = "pivoted";
    founder.memory = [
      `Pivoting toward ${nextCompanyType.toLowerCase()} because ${DISTRICT_BY_ID[nextTarget].label} is now the best path.`,
      ...founder.memory,
    ].slice(0, 6);
  }

  founder.targetDistrict = nextTarget;
  founder.route = nextRoute;
  founder.routeIndex = 0;
  founder.routeProgress = 0;
  founder.companyType = nextCompanyType;
}

function founderSpeech(founder: FounderAgentState) {
  if (founder.status === "breakout") {
    return `${founder.companyType} breakout. We made it.`;
  }

  if (founder.status === "dead") {
    return "Out of runway. Closing down.";
  }

  if (founder.status === "stalled") {
    return "We are stuck and the burn is winning.";
  }

  const weakestNeed = founder.needs
    .slice()
    .sort(
      (left, right) =>
        founder.resourceProgress[left] - founder.resourceProgress[right],
    )[0];

  return `Still hunting ${weakestNeed} before the runway disappears.`;
}

function founderHeadline(founder: FounderAgentState) {
  if (founder.status === "breakout") {
    return `${founder.name} just broke out as a ${founder.companyType.toLowerCase()}.`;
  }

  if (founder.status === "dead") {
    return `${founder.name} ran out of runway.`;
  }

  if (founder.status === "pivoted") {
    return `${founder.name} is pivoting through ${DISTRICT_BY_ID[founder.targetDistrict].label}.`;
  }

  return "";
}

function stepFounder(
  founder: FounderAgentState,
  districts: Record<DistrictId, DistrictState>,
  elapsedMs: number,
  deltaMs: number,
) {
  const updated = {
    ...founder,
    needs: [...founder.needs],
    route: [...founder.route],
    memory: [...founder.memory],
    influencedBy: [...founder.influencedBy],
    resourceProgress: { ...founder.resourceProgress },
  };

  if (updated.status === "dead" || updated.status === "breakout") {
    return updated;
  }

  updated.runway = clamp(updated.runway - (updated.burnRate * deltaMs) / 30_000, 0, 100);

  const currentDistrict = districts[updated.currentDistrict];
  const movementPenalty = currentDistrict.stats.congestion / 100;
  const movementSpeed = clamp(0.24 - movementPenalty * 0.12, 0.04, 0.24);

  if (updated.route.length > 1 && updated.routeIndex < updated.route.length - 1) {
    updated.routeProgress += movementSpeed * (deltaMs / SIM_TICK_MS);

    while (
      updated.routeProgress >= 1 &&
      updated.routeIndex < updated.route.length - 1
    ) {
      updated.routeProgress -= 1;
      updated.routeIndex += 1;
      updated.currentDistrict = updated.route[updated.routeIndex] ?? updated.currentDistrict;
      harvestDistrict(updated, districts[updated.currentDistrict]);
    }
  } else {
    harvestDistrict(updated, currentDistrict);
  }

  if (updated.currentDistrict === updated.targetDistrict) {
    setFounderTarget(
      updated,
      districts,
      `${elapsedMs}:${updated.id}:${updated.routeIndex}:${updated.runway.toFixed(1)}`,
    );
  }

  updated.status = updateFounderStatus(updated);
  updated.speechBubble = founderSpeech(updated);
  updated.lastDecisionAt = elapsedMs;

  return updated;
}

function founderPresenceByDistrict(founders: FounderAgentState[]) {
  return founders.reduce<Record<DistrictId, number>>(
    (accumulator, founder) => {
      accumulator[founder.currentDistrict] +=
        founder.status === "dead" ? 0 : founder.status === "breakout" ? 2 : 1;
      return accumulator;
    },
    {
      soma: 0,
      fidi: 0,
      mission: 0,
      hayes: 0,
      dogpatch: 0,
      "mission-bay": 0,
      "north-beach": 0,
      "sunset-richmond": 0,
    },
  );
}

function driftDistricts(
  districts: Record<DistrictId, DistrictState>,
  founders: FounderAgentState[],
  playerStartups: CityState["playerStartups"],
  deltaMs: number,
) {
  const founderPresence = founderPresenceByDistrict(founders);
  const playerPresence = playerStartups.reduce<Record<DistrictId, number>>(
    (accumulator, startup) => {
      accumulator[startup.districtId] +=
        startup.status === "dead" ? 0 : startup.status === "breakout" ? 2.5 : 1.25;
      return accumulator;
    },
    {
      soma: 0,
      fidi: 0,
      mission: 0,
      hayes: 0,
      dogpatch: 0,
      "mission-bay": 0,
      "north-beach": 0,
      "sunset-richmond": 0,
    },
  );
  const deltaScale = deltaMs / 1000;

  for (const [districtId, district] of Object.entries(districts) as Array<
    [DistrictId, DistrictState]
  >) {
    const base = DISTRICT_BY_ID[districtId];
    const presence = founderPresence[districtId] + playerPresence[districtId];

    district.stats.capital = clamp(
      district.stats.capital + (base.stats.capital - district.stats.capital) * 0.05 * deltaScale,
      0,
      100,
    );
    district.stats.talent = clamp(
      district.stats.talent + (base.stats.talent - district.stats.talent) * 0.06 * deltaScale,
      0,
      100,
    );
    district.stats.compute = clamp(
      district.stats.compute + (base.stats.compute - district.stats.compute) * 0.05 * deltaScale,
      0,
      100,
    );
    district.stats.permits = clamp(
      district.stats.permits + (base.stats.permits - district.stats.permits) * 0.07 * deltaScale,
      0,
      100,
    );
    district.stats.congestion = clamp(
      district.stats.congestion +
        ((base.stats.congestion + presence * 8) - district.stats.congestion) * 0.15 * deltaScale,
      0,
      100,
    );
    district.stats.rentPressure = clamp(
      base.stats.rentPressure * 0.35 +
        district.stats.capital * 0.32 +
        district.stats.compute * 0.14 +
        presence * 4,
      0,
      100,
    );
    district.stats.vibe = clamp(
      district.stats.vibe +
        ((base.stats.vibe + district.stats.localBusiness * 0.08 - presence * 0.7) -
          district.stats.vibe) *
          0.12 *
          deltaScale,
      0,
      100,
    );
    district.stats.localBusiness = clamp(
      district.stats.localBusiness +
        ((base.stats.localBusiness +
          district.stats.vibe * 0.08 -
          Math.max(0, district.stats.rentPressure - 60) * 0.18) -
          district.stats.localBusiness) *
          0.12 *
          deltaScale,
      0,
      100,
    );
  }

  return districts;
}

function weakestDistrictBy(
  state: CityState,
  selector: (district: DistrictState) => number,
  descending = true,
) {
  const sorted = Object.values(state.districts).sort((left, right) =>
    descending ? selector(right) - selector(left) : selector(left) - selector(right),
  );
  return sorted[0];
}

function buildVoteOption(
  state: CityState,
  type: Intervention["type"],
  targetDistrict: DistrictId,
  effect: Partial<ResourceVector>,
  label: string,
  description: string,
): VoteOption {
  return {
    id: `${type}-${targetDistrict}`,
    label,
    description,
    intervention: {
      id: randomId(
        `intervention-${type}`,
        createSeededRandom(`${state.seed}:${state.tick}:${type}:${targetDistrict}`),
      ),
      type,
      label,
      description,
      targetDistrict,
      intensity: 1,
      effect,
    },
  };
}

function votePromptFromState(state: CityState) {
  const score = state.score;
  const weakestMetric = Object.entries(score).sort((left, right) => left[1] - right[1])[0]?.[0];

  switch (weakestMetric) {
    case "commuteHealth":
      return "The city is seizing up. Do we fix movement or buy ourselves time?";
    case "localBusiness":
      return "Neighborhoods are thinning out. Which intervention keeps the city alive?";
    case "startupSurvival":
      return "Founders are running out of runway. Where should the city spend its leverage?";
    case "neighborhoodBalance":
      return "The board is drifting toward monoculture. What do we rebalance now?";
    case "vibeIndex":
    default:
      return "Founder energy is flattening out. Which move keeps San Francisco weird and productive?";
  }
}

export function createVoteRound(state: CityState, nowMs: number): VoteRound {
  const transitDistrict =
    weakestDistrictBy(state, (district) => district.stats.congestion)!.id;
  const capitalDistrict =
    weakestDistrictBy(state, (district) => district.stats.capital, false)!.id;
  const cultureDistrict =
    weakestDistrictBy(
      state,
      (district) => district.stats.vibe + district.stats.localBusiness,
      false,
    )!.id;
  const permitDistrict =
    weakestDistrictBy(
      state,
      (district) => district.stats.compute + district.stats.capital - district.stats.permits,
    )!.id;

  const allOptions = [
    buildVoteOption(
      state,
      "transit_connector",
      transitDistrict,
      {
        congestion: -18,
        talent: 8,
        vibe: 4,
      },
      `Add a fast connector to ${state.districts[transitDistrict].label}`,
      "Cut commute drag and free up movement through the city spine.",
    ),
    buildVoteOption(
      state,
      "capital_grant",
      capitalDistrict,
      {
        capital: 18,
        compute: 8,
        rentPressure: 7,
      },
      `Deploy a capital pulse in ${state.districts[capitalDistrict].label}`,
      "Drop grant money and cloud credits into a district that needs fuel.",
    ),
    buildVoteOption(
      state,
      "culture_festival",
      cultureDistrict,
      {
        vibe: 18,
        localBusiness: 14,
        congestion: 4,
      },
      `Stage a culture festival in ${state.districts[cultureDistrict].label}`,
      "Boost neighborhood energy and pull customers back into the street.",
    ),
    buildVoteOption(
      state,
      "permit_fast_lane",
      permitDistrict,
      {
        permits: 20,
        congestion: -6,
      },
      `Open a permit fast lane for ${state.districts[permitDistrict].label}`,
      "Relieve launch friction where high-growth teams are about to jam the system.",
    ),
  ];

  const random = createSeededRandom(`${state.seed}:vote:${state.tick}:${nowMs}`);
  const options = shuffle(allOptions, random).slice(0, 3);

  return {
    id: randomId("vote", random),
    prompt: votePromptFromState(state),
    options,
    opensAt: nowMs,
    closesAt: nowMs + VOTE_WINDOW_MS,
    resolvedOptionId: null,
    tallies: Object.fromEntries(options.map((option) => [option.id, 0])),
  };
}

function spreadTransitEffects(
  state: CityState,
  targetDistrict: DistrictId,
  effect: Partial<ResourceVector>,
) {
  const target = state.districts[targetDistrict];
  applyEffect(target, effect);

  const neighborIds = state.edges.flatMap((edge) => {
    if (edge.from === targetDistrict) {
      return [edge.to];
    }

    if (edge.to === targetDistrict) {
      return [edge.from];
    }

    return [];
  });

  for (const neighborId of [...new Set(neighborIds)]) {
    applyEffect(state.districts[neighborId], effect, 0.35);
  }
}

export function applyVoteResolution(
  state: CityState,
  voteRound: VoteRound,
  resolvedOptionId?: string | null,
): CityState {
  const nextState = cloneState(state);
  const talliedRound = cloneState({
    ...nextState,
    activeVoteRound: voteRound,
  }).activeVoteRound as VoteRound;

  const rankedOptions = talliedRound.options.slice().sort((left, right) => {
    const tallyDifference =
      (talliedRound.tallies[right.id] ?? 0) - (talliedRound.tallies[left.id] ?? 0);

    if (tallyDifference !== 0) {
      return tallyDifference;
    }

    return left.id.localeCompare(right.id);
  });

  const winningOption =
    (resolvedOptionId
      ? rankedOptions.find((option) => option.id === resolvedOptionId)
      : null) ?? rankedOptions[0] ?? talliedRound.options[0];

  if (!winningOption) {
    return nextState;
  }

  talliedRound.resolvedOptionId = winningOption.id;
  nextState.interventions.push(winningOption.intervention);

  if (winningOption.intervention.type === "transit_connector") {
    spreadTransitEffects(
      nextState,
      winningOption.intervention.targetDistrict,
      winningOption.intervention.effect,
    );
  } else {
    applyEffect(
      nextState.districts[winningOption.intervention.targetDistrict],
      winningOption.intervention.effect,
    );
  }

  nextState.resolvedVotes.push(talliedRound);
  nextState.activeVoteRound = null;
  appendTicker(nextState, `Vote resolved: ${winningOption.label}.`);
  nextState.headline = winningOption.label;
  nextState.score = deriveScore(nextState);

  return nextState;
}

function applyEvent(state: CityState, eventCard: EventCard) {
  for (const districtId of eventCard.affectedDistricts) {
    applyEffect(state.districts[districtId], eventCard.effect);
  }

  state.eventLog.unshift(eventCard);
  state.eventLog = state.eventLog.slice(0, 8);
  appendTicker(state, eventCard.tickerCopy);
  state.headline = eventCard.title;
}

function maybeTriggerEvent(state: CityState) {
  if (state.elapsedMs < state.nextEventAt) {
    return;
  }

  const nextTemplate = state.eventDeck[state.eventLog.length % state.eventDeck.length];

  if (!nextTemplate) {
    state.nextEventAt += EVENT_INTERVAL_MS;
    return;
  }

  const eventCard = materializeEventCard(nextTemplate, state, state.elapsedMs);
  applyEvent(state, eventCard);
  state.nextEventAt += EVENT_INTERVAL_MS;
}

function maybeOpenVote(state: CityState) {
  if (state.activeVoteRound || state.elapsedMs < state.nextVoteAt) {
    return;
  }

  state.activeVoteRound = createVoteRound(state, state.elapsedMs);
  appendTicker(state, `Vote open: ${state.activeVoteRound.prompt}`);
  state.headline = "Audience intervention window is open.";
  state.nextVoteAt += VOTE_INTERVAL_MS;
}

function maybeResolveVote(state: CityState) {
  if (!state.activeVoteRound || state.elapsedMs < state.activeVoteRound.closesAt) {
    return state;
  }

  return applyVoteResolution(state, state.activeVoteRound);
}

function maybeRollAgentWindow(state: CityState) {
  if (state.elapsedMs < state.nextAgentTickAt) {
    return;
  }

  state.nextAgentTickAt += AGENT_TICK_INTERVAL_MS;
  appendTicker(state, "City managers are reassessing permits, transit, capital, and vibe.");
}

function liveHeadline(state: CityState) {
  const standoutPlayerStartup = state.playerStartups.find(
    (startup) =>
      startup.controlMode === "player" &&
      (startup.status === "breakout" || startup.status === "distressed"),
  );
  if (standoutPlayerStartup?.status === "breakout") {
    return `${standoutPlayerStartup.name} is now one of the tallest towers in ${state.districts[standoutPlayerStartup.districtId].label}.`;
  }

  if (standoutPlayerStartup?.status === "distressed") {
    return `${standoutPlayerStartup.name} is wobbling in ${state.districts[standoutPlayerStartup.districtId].label}.`;
  }

  const latestFounderHeadline = state.founders
    .map((founder) => founderHeadline(founder))
    .find(Boolean);

  if (latestFounderHeadline) {
    return latestFounderHeadline;
  }

  if (state.activeVoteRound) {
    return `Vote live: ${state.activeVoteRound.prompt}`;
  }

  if (state.eventLog[0]) {
    return state.eventLog[0].title;
  }

  if (state.score.startupSurvival < 40) {
    return "The founder ecosystem is close to collapse.";
  }

  if (state.score.vibeIndex > 65 && state.score.localBusiness > 60) {
    return "The city feels weird, alive, and barely under control.";
  }

  if (state.score.neighborhoodBalance < 45) {
    return "The city is drifting toward monoculture.";
  }

  return "Founder City is humming for now.";
}

function tickState(state: CityState, deltaMs: number) {
  state.tick += 1;
  state.elapsedMs = clamp(state.elapsedMs + deltaMs, 0, RUN_DURATION_MS);
  state.remainingMs = clamp(RUN_DURATION_MS - state.elapsedMs, 0, RUN_DURATION_MS);

  state.founders = state.founders.map((founder) =>
    stepFounder(founder, state.districts, state.elapsedMs, deltaMs),
  );
  advancePlayerStartups(state, state.elapsedMs, deltaMs);
  state.districts = driftDistricts(state.districts, state.founders, state.playerStartups, deltaMs);

  maybeOpenVote(state);
  maybeTriggerEvent(state);
  maybeRollAgentWindow(state);

  const resolvedState = maybeResolveVote(state);
  const workingState = resolvedState === state ? state : resolvedState;

  workingState.score = deriveScore(workingState);
  workingState.headline = liveHeadline(workingState);

  if (workingState.remainingMs <= 0) {
    workingState.status = "ended";
    workingState.summary = createRunSummary(workingState);
    workingState.headline = workingState.summary.headline;
  }

  return workingState;
}

export function advanceCityState(state: CityState, nowMs: number): CityState {
  const nextState = cloneState(state);
  const normalizedNowMs =
    nowMs > RUN_DURATION_MS * 2 ? nextState.elapsedMs + SIM_TICK_MS : nowMs;
  const targetElapsedMs = clamp(normalizedNowMs, nextState.elapsedMs, RUN_DURATION_MS);

  while (nextState.elapsedMs < targetElapsedMs && nextState.status !== "ended") {
    const deltaMs = Math.min(SIM_TICK_MS, targetElapsedMs - nextState.elapsedMs);
    const steppedState = tickState(nextState, deltaMs);

    if (steppedState !== nextState) {
      Object.assign(nextState, steppedState);
    }
  }

  if (nextState.status !== "ended") {
    nextState.score = deriveScore(nextState);
    nextState.headline = liveHeadline(nextState);
  }

  return nextState;
}

function cityPersonality(state: CityState) {
  const score = state.score;

  if (
    score.startupSurvival > 70 &&
    score.vibeIndex > 65 &&
    score.neighborhoodBalance > 58
  ) {
    return "A weird but thriving founder city";
  }

  if (score.startupSurvival > 72 && score.neighborhoodBalance < 45) {
    return "An overclocked monoculture";
  }

  if (score.localBusiness > 65 && score.vibeIndex > 65) {
    return "A neighborhood-first founder ecosystem";
  }

  if (score.commuteHealth < 40) {
    return "A gridlocked city running on brute force and caffeine";
  }

  return "A fragile but still salvageable founder ecosystem";
}

function districtOutcome(district: DistrictState) {
  if (district.stats.compute > 80 && district.stats.capital > 70) {
    return `${district.label} overheated into an AI capital magnet.`;
  }

  if (district.stats.vibe > 72 && district.stats.localBusiness > 68) {
    return `${district.label} stayed culturally alive and commercially sticky.`;
  }

  if (district.stats.rentPressure > 75 && district.stats.localBusiness < 45) {
    return `${district.label} was squeezed by rent pressure and thinning storefronts.`;
  }

  if (district.stats.permits > 65) {
    return `${district.label} became unusually easy to launch from.`;
  }

  return `${district.label} stayed in the mix without fully dominating the city.`;
}

function founderOutcome(founder: FounderAgentState) {
  switch (founder.status) {
    case "breakout":
      return `${founder.name} became a ${founder.companyType.toLowerCase()} breakout.`;
    case "dead":
      return `${founder.name} died in the gap between burn and city support.`;
    case "stalled":
      return `${founder.name} stalled while waiting on the wrong mix of city inputs.`;
    case "pivoted":
      return `${founder.name} pivoted into a ${founder.companyType.toLowerCase()}.`;
    case "relocating":
      return `${founder.name} was still relocating when the clock ran out.`;
    case "active":
    default:
      return `${founder.name} survived as a ${founder.companyType.toLowerCase()} contender.`;
  }
}

export function createRunSummary(state: CityState): RunSummary {
  const score = deriveScore(state);
  const standoutDistricts = Object.values(state.districts)
    .sort(
      (left, right) =>
        right.stats.vibe +
        right.stats.localBusiness +
        right.stats.capital -
        right.stats.congestion -
        (left.stats.vibe +
          left.stats.localBusiness +
          left.stats.capital -
          left.stats.congestion),
    )
    .slice(0, 4)
    .map(districtOutcome);

  const notableInterventions =
    state.resolvedVotes.length > 0
      ? state.resolvedVotes
          .slice(-3)
          .map((vote) => {
            const option = vote.options.find(
              (candidate) => candidate.id === vote.resolvedOptionId,
            );
            return option
              ? `${option.label} shifted ${state.districts[option.intervention.targetDistrict].label}.`
              : "A late intervention landed without a clear winner.";
          })
      : ["No audience intervention landed before the timer expired."];

  const breakouts = state.founders.filter((founder) => founder.status === "breakout").length;
  const shutdowns = state.founders.filter((founder) => founder.status === "dead").length;
  const topDistrict = Object.values(state.districts).sort(
    (left, right) =>
      right.stats.capital +
      right.stats.compute +
      right.stats.vibe -
      right.stats.congestion -
      (left.stats.capital +
        left.stats.compute +
        left.stats.vibe -
        left.stats.congestion),
  )[0];

  const headline = `You built ${cityPersonality(state).toLowerCase()}: ${topDistrict.label} led the run, ${breakouts} startup${breakouts === 1 ? "" : "s"} broke out, and ${shutdowns} died.`;

  return {
    headline,
    dek: `${breakouts} launch-ready winner${breakouts === 1 ? "" : "s"}, ${shutdowns} shutdown${shutdowns === 1 ? "" : "s"}, and a ${Math.round(score.neighborhoodBalance)} neighborhood balance score.`,
    cityPersonality: cityPersonality(state),
    districtOutcomes: standoutDistricts,
    founderOutcomes: state.founders.map(founderOutcome),
    playerStartupOutcomes: buildPlayerStartupOutcomes(state),
    notableInterventions,
    score,
  };
}
