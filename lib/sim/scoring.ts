import type {
  CityState,
  FounderAgentState,
  PlayerStartupState,
  ResourceKey,
  ScoreState,
} from "@/lib/types/city";
import { average, clamp } from "@/lib/utils";

const BALANCE_KEYS: readonly ResourceKey[] = [
  "capital",
  "talent",
  "compute",
  "permits",
  "vibe",
  "localBusiness",
] as const;

function founderStatusWeight(founder: FounderAgentState) {
  switch (founder.status) {
    case "breakout":
      return 100;
    case "pivoted":
      return 82;
    case "relocating":
      return 72;
    case "stalled":
      return 42;
    case "dead":
      return 0;
    case "active":
    default:
      return 68;
  }
}

function averageFounderProgress(founder: FounderAgentState) {
  return average(founder.needs.map((need) => founder.resourceProgress[need]));
}

function startupStatusWeight(startup: PlayerStartupState) {
  switch (startup.status) {
    case "breakout":
      return 100;
    case "growing":
      return 82;
    case "steady":
      return 70;
    case "distressed":
      return 34;
    case "dead":
      return 0;
    case "launching":
    default:
      return 56;
  }
}

function deriveStartupSurvival(state: Pick<CityState, "founders" | "playerStartups">) {
  const founderHealth = state.founders.map((founder) =>
    clamp(
      founderStatusWeight(founder) * 0.65 +
        founder.runway * 0.2 +
        averageFounderProgress(founder) * 0.15,
      0,
      100,
    ),
  );

  const playerStartupHealth = state.playerStartups.map((startup) =>
    clamp(
      startupStatusWeight(startup) * 0.6 +
        startup.cash * 0.18 +
        startup.traction * 0.12 +
        startup.resilience * 0.1,
      0,
      100,
    ),
  );

  return clamp(average([...founderHealth, ...playerStartupHealth]), 0, 100);
}

function deriveCommuteHealth(state: Pick<CityState, "districts">) {
  const districts = Object.values(state.districts);
  const averageCongestion = average(districts.map((district) => district.stats.congestion));
  const hardBottlenecks = districts.filter((district) => district.stats.congestion > 80).length;

  return clamp(100 - averageCongestion * 0.9 - hardBottlenecks * 5, 0, 100);
}

function deriveLocalBusiness(state: Pick<CityState, "districts">) {
  const districts = Object.values(state.districts);
  const localHealth = districts.map((district) =>
    clamp(
      district.stats.localBusiness -
        Math.max(0, district.stats.rentPressure - 65) * 0.55 +
        district.stats.vibe * 0.18,
      0,
      100,
    ),
  );

  return clamp(average(localHealth), 0, 100);
}

function deriveVibeIndex(state: Pick<CityState, "districts">) {
  const districts = Object.values(state.districts);
  const vibeReadings = districts.map((district) =>
    clamp(
      district.stats.vibe +
        district.stats.localBusiness * 0.15 -
        district.stats.congestion * 0.12,
      0,
      100,
    ),
  );

  return clamp(average(vibeReadings), 0, 100);
}

function deriveNeighborhoodBalance(state: Pick<CityState, "districts">) {
  const districts = Object.values(state.districts);

  const deviations = BALANCE_KEYS.map((key) => {
    const values = districts.map((district) => district.stats[key]);
    const mean = average(values);
    const averageAbsoluteDeviation = average(
      values.map((value) => Math.abs(value - mean)),
    );

    return averageAbsoluteDeviation;
  });

  return clamp(100 - average(deviations) * 1.65, 0, 100);
}

export function deriveScore(state: Pick<CityState, "founders" | "playerStartups" | "districts">): ScoreState {
  return {
    startupSurvival: deriveStartupSurvival(state),
    commuteHealth: deriveCommuteHealth(state),
    localBusiness: deriveLocalBusiness(state),
    vibeIndex: deriveVibeIndex(state),
    neighborhoodBalance: deriveNeighborhoodBalance(state),
  };
}
