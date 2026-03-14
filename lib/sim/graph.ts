import type {
  CityEdge,
  CityState,
  DistrictId,
  DistrictState,
  FounderAgentState,
  FounderNeed,
  FounderResourceProgress,
  MapCameraState,
  ManagerAgentState,
  ResourceVector,
} from "@/lib/types/city";

import { createEventDeck } from "./events";
import { createStartupParcels, seedAmbientPlayerStartups } from "./player-startups";
import { createSeededRandom } from "./random";
import { deriveScore } from "./scoring";

export const RUN_DURATION_MS = 150_000;
export const SIM_TICK_MS = 500;
export const VOTE_INTERVAL_MS = 20_000;
export const VOTE_WINDOW_MS = 10_000;
export const AGENT_TICK_INTERVAL_MS = 12_000;
export const EVENT_INTERVAL_MS = 18_000;
export const DEFAULT_MAP_CAMERA: MapCameraState = {
  longitude: -122.4158,
  latitude: 37.7783,
  zoom: 12.55,
  pitch: 72,
  bearing: -28,
};

function resourceVector(values: ResourceVector): ResourceVector {
  return { ...values };
}

function founderProgress(
  values?: Partial<FounderResourceProgress>,
): FounderResourceProgress {
  return {
    capital: values?.capital ?? 0,
    talent: values?.talent ?? 0,
    compute: values?.compute ?? 0,
    permits: values?.permits ?? 0,
    vibe: values?.vibe ?? 0,
    localBusiness: values?.localBusiness ?? 0,
  };
}

export const DISTRICTS: readonly DistrictState[] = [
  {
    id: "soma",
    label: "SoMa",
    color: "#00e2ff",
    position: { x: 430, y: 290 },
    geo: { lng: -122.4069, lat: 37.7786 },
    tags: ["compute", "ai", "infra"],
    halo: "rgba(0, 226, 255, 0.32)",
    stats: resourceVector({
      capital: 78,
      talent: 69,
      compute: 94,
      permits: 36,
      vibe: 41,
      localBusiness: 38,
      congestion: 74,
      rentPressure: 82,
    }),
  },
  {
    id: "fidi",
    label: "FiDi",
    color: "#ffd166",
    position: { x: 555, y: 230 },
    geo: { lng: -122.4006, lat: 37.7948 },
    tags: ["capital", "scale", "finance"],
    halo: "rgba(255, 209, 102, 0.28)",
    stats: resourceVector({
      capital: 96,
      talent: 58,
      compute: 62,
      permits: 44,
      vibe: 34,
      localBusiness: 47,
      congestion: 68,
      rentPressure: 75,
    }),
  },
  {
    id: "mission",
    label: "Mission",
    color: "#ff6f61",
    position: { x: 320, y: 395 },
    geo: { lng: -122.4194, lat: 37.7598 },
    tags: ["culture", "consumer", "nightlife"],
    halo: "rgba(255, 111, 97, 0.28)",
    stats: resourceVector({
      capital: 46,
      talent: 61,
      compute: 42,
      permits: 48,
      vibe: 88,
      localBusiness: 72,
      congestion: 59,
      rentPressure: 63,
    }),
  },
  {
    id: "hayes",
    label: "Hayes Valley",
    color: "#f4d35e",
    position: { x: 315, y: 265 },
    geo: { lng: -122.4254, lat: 37.7764 },
    tags: ["design", "retail", "taste"],
    halo: "rgba(244, 211, 94, 0.22)",
    stats: resourceVector({
      capital: 41,
      talent: 58,
      compute: 38,
      permits: 53,
      vibe: 71,
      localBusiness: 69,
      congestion: 47,
      rentPressure: 57,
    }),
  },
  {
    id: "dogpatch",
    label: "Dogpatch",
    color: "#ff9f1c",
    position: { x: 495, y: 435 },
    geo: { lng: -122.3882, lat: 37.7596 },
    tags: ["prototyping", "robotics", "hardware"],
    halo: "rgba(255, 159, 28, 0.28)",
    stats: resourceVector({
      capital: 57,
      talent: 63,
      compute: 54,
      permits: 46,
      vibe: 55,
      localBusiness: 49,
      congestion: 43,
      rentPressure: 58,
    }),
  },
  {
    id: "mission-bay",
    label: "Mission Bay",
    color: "#7ae582",
    position: { x: 545, y: 375 },
    geo: { lng: -122.3893, lat: 37.7712 },
    tags: ["biotech", "labs", "health"],
    halo: "rgba(122, 229, 130, 0.24)",
    stats: resourceVector({
      capital: 66,
      talent: 74,
      compute: 58,
      permits: 41,
      vibe: 36,
      localBusiness: 34,
      congestion: 52,
      rentPressure: 61,
    }),
  },
  {
    id: "north-beach",
    label: "North Beach",
    color: "#c77dff",
    position: { x: 535, y: 120 },
    geo: { lng: -122.4101, lat: 37.8063 },
    tags: ["nightlife", "community", "consumer"],
    halo: "rgba(199, 125, 255, 0.24)",
    stats: resourceVector({
      capital: 39,
      talent: 46,
      compute: 34,
      permits: 56,
      vibe: 83,
      localBusiness: 78,
      congestion: 38,
      rentPressure: 52,
    }),
  },
  {
    id: "sunset-richmond",
    label: "Sunset / Richmond",
    color: "#8ecae6",
    position: { x: 120, y: 320 },
    geo: { lng: -122.4846, lat: 37.7632 },
    tags: ["retention", "housing", "stability"],
    halo: "rgba(142, 202, 230, 0.22)",
    stats: resourceVector({
      capital: 28,
      talent: 55,
      compute: 26,
      permits: 62,
      vibe: 63,
      localBusiness: 66,
      congestion: 28,
      rentPressure: 36,
    }),
  },
] as const;

export const EDGES: readonly CityEdge[] = [
  {
    id: "edge-sunset-hayes",
    from: "sunset-richmond",
    to: "hayes",
    baseDistance: 1.5,
    lineColor: "#8ecae6",
  },
  {
    id: "edge-sunset-mission",
    from: "sunset-richmond",
    to: "mission",
    baseDistance: 1.65,
    lineColor: "#8ecae6",
  },
  {
    id: "edge-hayes-soma",
    from: "hayes",
    to: "soma",
    baseDistance: 1,
    lineColor: "#00e2ff",
  },
  {
    id: "edge-hayes-mission",
    from: "hayes",
    to: "mission",
    baseDistance: 1.1,
    lineColor: "#ff6f61",
  },
  {
    id: "edge-hayes-northbeach",
    from: "hayes",
    to: "north-beach",
    baseDistance: 1.35,
    lineColor: "#c77dff",
  },
  {
    id: "edge-soma-fidi",
    from: "soma",
    to: "fidi",
    baseDistance: 0.95,
    lineColor: "#ffd166",
  },
  {
    id: "edge-soma-mission",
    from: "soma",
    to: "mission",
    baseDistance: 1.05,
    lineColor: "#ff6f61",
  },
  {
    id: "edge-soma-dogpatch",
    from: "soma",
    to: "dogpatch",
    baseDistance: 1.4,
    lineColor: "#ff9f1c",
  },
  {
    id: "edge-soma-missionbay",
    from: "soma",
    to: "mission-bay",
    baseDistance: 1.2,
    lineColor: "#7ae582",
  },
  {
    id: "edge-fidi-northbeach",
    from: "fidi",
    to: "north-beach",
    baseDistance: 0.9,
    lineColor: "#ffd166",
  },
  {
    id: "edge-mission-dogpatch",
    from: "mission",
    to: "dogpatch",
    baseDistance: 1.35,
    lineColor: "#ff9f1c",
  },
  {
    id: "edge-dogpatch-missionbay",
    from: "dogpatch",
    to: "mission-bay",
    baseDistance: 0.85,
    lineColor: "#7ae582",
  },
] as const;

export const HERO_FOUNDER_SEEDS: readonly FounderAgentState[] = [
  {
    id: "founder-harbor-robotics",
    name: "Harbor Robotics",
    avatarHue: "#ff9f1c",
    pitch:
      "A two-person robotics startup trying to turn warehouse labor bottlenecks into autonomous workflows.",
    temperament: "hardware optimist",
    burnRate: 4.1,
    pivotTolerance: 0.68,
    origin: "dogpatch",
    currentDistrict: "dogpatch",
    targetDistrict: "dogpatch",
    route: ["dogpatch"],
    routeIndex: 0,
    routeProgress: 0,
    status: "active",
    companyType: "Unshaped startup",
    needs: ["capital", "talent", "permits", "compute"],
    resourceProgress: founderProgress(),
    memory: ["We need prototyping, capital, and permits before the runway vanishes."],
    speechBubble: "Seeking prototyping, capital, and a permit queue that actually moves.",
    runway: 82,
    influencedBy: ["dogpatch"],
    lastDecisionAt: 0,
  },
  {
    id: "founder-night-shift",
    name: "Night Shift Social",
    avatarHue: "#c77dff",
    pitch:
      "A consumer founder duo building a social layer for real-world repeat hangouts and local commerce.",
    temperament: "community builder",
    burnRate: 3.2,
    pivotTolerance: 0.84,
    origin: "north-beach",
    currentDistrict: "north-beach",
    targetDistrict: "north-beach",
    route: ["north-beach"],
    routeIndex: 0,
    routeProgress: 0,
    status: "active",
    companyType: "Unshaped startup",
    needs: ["vibe", "localBusiness", "talent", "capital"],
    resourceProgress: founderProgress(),
    memory: ["We need foot traffic, vibe, and a city that stays interesting after 8pm."],
    speechBubble: "Need customers and culture, not just cloud credits.",
    runway: 86,
    influencedBy: ["north-beach"],
    lastDecisionAt: 0,
  },
  {
    id: "founder-bay-bio",
    name: "Bay Bio Systems",
    avatarHue: "#7ae582",
    pitch:
      "A biotech team trying to pair wet-lab research with software-driven drug discovery.",
    temperament: "lab rat",
    burnRate: 4.6,
    pivotTolerance: 0.42,
    origin: "mission-bay",
    currentDistrict: "mission-bay",
    targetDistrict: "mission-bay",
    route: ["mission-bay"],
    routeIndex: 0,
    routeProgress: 0,
    status: "active",
    companyType: "Unshaped startup",
    needs: ["permits", "talent", "capital", "compute"],
    resourceProgress: founderProgress(),
    memory: ["Mission Bay gets us close to labs, but permits can still kill the company."],
    speechBubble: "We need permits, talent, and patient capital before the burn catches us.",
    runway: 78,
    influencedBy: ["mission-bay"],
    lastDecisionAt: 0,
  },
  {
    id: "founder-gridline",
    name: "Gridline Compute",
    avatarHue: "#00e2ff",
    pitch:
      "A tiny infra team hunting for cheap compute, great engineers, and enough capital to scale fast.",
    temperament: "blitzscaler",
    burnRate: 4.8,
    pivotTolerance: 0.53,
    origin: "soma",
    currentDistrict: "soma",
    targetDistrict: "soma",
    route: ["soma"],
    routeIndex: 0,
    routeProgress: 0,
    status: "active",
    companyType: "Unshaped startup",
    needs: ["compute", "capital", "talent"],
    resourceProgress: founderProgress(),
    memory: ["If SoMa overheats, we may need to reroute before rent pressure kills the stack."],
    speechBubble: "Compute first, capital second, existential dread third.",
    runway: 74,
    influencedBy: ["soma"],
    lastDecisionAt: 0,
  },
  {
    id: "founder-civic-studio",
    name: "Civic Studio",
    avatarHue: "#f4d35e",
    pitch:
      "A design-forward neighborhood commerce tool trying to keep local businesses alive without flattening the city.",
    temperament: "design maximalist",
    burnRate: 2.9,
    pivotTolerance: 0.76,
    origin: "hayes",
    currentDistrict: "hayes",
    targetDistrict: "hayes",
    route: ["hayes"],
    routeIndex: 0,
    routeProgress: 0,
    status: "active",
    companyType: "Unshaped startup",
    needs: ["localBusiness", "vibe", "capital", "permits"],
    resourceProgress: founderProgress(),
    memory: ["The city has to stay livable or the product has no reason to exist."],
    speechBubble: "Need neighborhood energy and enough capital to avoid becoming another deck.",
    runway: 91,
    influencedBy: ["hayes"],
    lastDecisionAt: 0,
  },
] as const;

export const MANAGER_SEEDS: readonly ManagerAgentState[] = [
  {
    id: "manager-permits",
    name: "Permit Agent",
    department: "permits",
    speechBubble: "Watching launch approvals and backlog heat.",
    targetDistrict: "mission-bay",
    recommendationType: "watchlist",
    impact: 8,
    lastDecisionAt: 0,
  },
  {
    id: "manager-transit",
    name: "Transit Agent",
    department: "transit",
    speechBubble: "Monitoring congestion, connectors, and commute pain.",
    targetDistrict: "soma",
    recommendationType: "watchlist",
    impact: 8,
    lastDecisionAt: 0,
  },
  {
    id: "manager-capital",
    name: "Capital Agent",
    department: "capital",
    speechBubble: "Deploying grants, hype, and selective overfunding.",
    targetDistrict: "fidi",
    recommendationType: "watchlist",
    impact: 8,
    lastDecisionAt: 0,
  },
  {
    id: "manager-community",
    name: "Community Agent",
    department: "community",
    speechBubble: "Protecting local business, nightlife, and neighborhood weirdness.",
    targetDistrict: "mission",
    recommendationType: "watchlist",
    impact: 8,
    lastDecisionAt: 0,
  },
] as const;

const TEMPERAMENT_BONUSES: Record<
  string,
  Partial<Record<FounderNeed | "rentPressure" | "congestion", number>>
> = {
  "hardware optimist": {
    permits: 1.3,
    compute: 0.9,
    capital: 1.1,
    congestion: -0.35,
  },
  "community builder": {
    vibe: 1.4,
    localBusiness: 1.3,
    capital: 0.7,
    rentPressure: -0.2,
  },
  "lab rat": {
    permits: 1.25,
    talent: 1.2,
    compute: 1.1,
    congestion: -0.15,
  },
  blitzscaler: {
    capital: 1.4,
    compute: 1.35,
    talent: 1.05,
    rentPressure: -0.1,
  },
  "design maximalist": {
    localBusiness: 1.35,
    vibe: 1.3,
    talent: 1.05,
    congestion: -0.1,
  },
};

export const DISTRICT_BY_ID = Object.fromEntries(
  DISTRICTS.map((district) => [district.id, district]),
) as Record<DistrictId, DistrictState>;

export function cloneDistricts() {
  return Object.fromEntries(
    DISTRICTS.map((district) => [
      district.id,
      {
        ...district,
        position: { ...district.position },
        geo: { ...district.geo },
        tags: [...district.tags],
        stats: { ...district.stats },
      },
    ]),
  ) as Record<DistrictId, DistrictState>;
}

function founderDistrictScore(
  founder: FounderAgentState,
  district: DistrictState,
) {
  const temperamentBonus = TEMPERAMENT_BONUSES[founder.temperament] ?? {};
  const needsScore = founder.needs.reduce((total, need) => {
    const weight = temperamentBonus[need] ?? 1;
    return total + district.stats[need] * weight;
  }, 0);

  const penalty =
    district.stats.congestion * Math.abs(temperamentBonus.congestion ?? -0.24) +
    district.stats.rentPressure * Math.abs(temperamentBonus.rentPressure ?? -0.18);

  const noveltyBonus = founder.influencedBy.includes(district.id) ? 0 : founder.pivotTolerance * 12;

  return needsScore - penalty + noveltyBonus;
}

export function listNeighbors(districtId: DistrictId, edges: readonly CityEdge[]) {
  return edges.flatMap((edge) => {
    if (edge.from === districtId) {
      return [{ districtId: edge.to, weight: edge.baseDistance }];
    }

    if (edge.to === districtId) {
      return [{ districtId: edge.from, weight: edge.baseDistance }];
    }

    return [];
  });
}

export function findShortestPath(
  from: DistrictId,
  to: DistrictId,
  edges: readonly CityEdge[] = EDGES,
) {
  if (from === to) {
    return [from];
  }

  const frontier = new Set<DistrictId>([from]);
  const distances = new Map<DistrictId, number>([[from, 0]]);
  const previous = new Map<DistrictId, DistrictId | null>([[from, null]]);

  while (frontier.size) {
    const current = [...frontier].sort(
      (left, right) =>
        (distances.get(left) ?? Number.POSITIVE_INFINITY) -
        (distances.get(right) ?? Number.POSITIVE_INFINITY),
    )[0];

    frontier.delete(current);

    if (current === to) {
      break;
    }

    for (const neighbor of listNeighbors(current, edges)) {
      const candidateDistance =
        (distances.get(current) ?? Number.POSITIVE_INFINITY) + neighbor.weight;

      if (candidateDistance < (distances.get(neighbor.districtId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.districtId, candidateDistance);
        previous.set(neighbor.districtId, current);
        frontier.add(neighbor.districtId);
      }
    }
  }

  if (!previous.has(to)) {
    return [from];
  }

  const path: DistrictId[] = [];
  let cursor: DistrictId | null = to;

  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
  }

  return path;
}

export const findRoute = findShortestPath;

export function chooseFounderTarget(
  founder: FounderAgentState,
  districts: Record<DistrictId, DistrictState>,
  seed: string,
) {
  const random = createSeededRandom(seed);
  const ranked = Object.values(districts)
    .filter((district) => district.id !== founder.currentDistrict)
    .sort(
      (left, right) =>
        founderDistrictScore(founder, right) - founderDistrictScore(founder, left),
    );

  const shortlist = ranked.slice(0, 3);
  return shortlist[Math.floor(random() * shortlist.length)]?.id ?? founder.currentDistrict;
}

export function inferCompanyType(founder: FounderAgentState) {
  const influenceSet = new Set(founder.influencedBy);

  if (influenceSet.has("mission-bay")) {
    return "Biotech health startup";
  }

  if (influenceSet.has("dogpatch")) {
    return "Robotics startup";
  }

  if (influenceSet.has("soma") || influenceSet.has("fidi")) {
    return "AI infra startup";
  }

  if (influenceSet.has("mission") || influenceSet.has("north-beach")) {
    return "Consumer community app";
  }

  if (influenceSet.has("hayes")) {
    return "Design-led commerce studio";
  }

  if (influenceSet.has("sunset-richmond")) {
    return "Neighborhood resilience SaaS";
  }

  return "Unshaped startup";
}

function createFounderState(seed: string, founder: FounderAgentState) {
  const targetDistrict = chooseFounderTarget(
    founder,
    cloneDistricts(),
    `${seed}:${founder.id}:target`,
  );
  const route = findShortestPath(founder.origin, targetDistrict);

  return {
    ...founder,
    route,
    targetDistrict,
    companyType: inferCompanyType(founder),
  };
}

export function createInitialCityState(
  seed: string,
  roomId: string,
  runId: string,
): CityState {
  const districts = cloneDistricts();
  const founders = HERO_FOUNDER_SEEDS.map((founder) =>
    createFounderState(seed, {
      ...founder,
      route: [...founder.route],
      needs: [...founder.needs],
      memory: [...founder.memory],
      influencedBy: [...founder.influencedBy],
      resourceProgress: { ...founder.resourceProgress },
    }),
  );
  const managers = MANAGER_SEEDS.map((manager) => ({ ...manager }));

  const draftState: CityState = {
    roomId,
    runId,
    seed,
    demoSeed: seed,
    status: "active",
    tick: 0,
    elapsedMs: 0,
    remainingMs: RUN_DURATION_MS,
    headline: "Founder City goes live.",
    ticker: [
      "Founder City is live: autonomous startups are looking for a path through San Francisco.",
      "SoMa is hot on compute, Dogpatch is prototyping-heavy, and Mission is carrying the vibe.",
      "Keep the city alive long enough for weird companies to survive.",
    ],
    audienceCount: 1,
    nextVoteAt: VOTE_INTERVAL_MS,
    nextAgentTickAt: AGENT_TICK_INTERVAL_MS,
    nextEventAt: EVENT_INTERVAL_MS,
    mapCamera: { ...DEFAULT_MAP_CAMERA },
    districts,
    edges: EDGES.map((edge) => ({ ...edge })),
    startupParcels: createStartupParcels(districts),
    founders,
    playerStartups: [],
    managers,
    score: {
      startupSurvival: 0,
      commuteHealth: 0,
      localBusiness: 0,
      vibeIndex: 0,
      neighborhoodBalance: 0,
    },
    interventions: [],
    activeVoteRound: null,
    resolvedVotes: [],
    eventDeck: createEventDeck(seed),
    eventLog: [],
    summary: null,
  };

  draftState.playerStartups = seedAmbientPlayerStartups(draftState);

  draftState.score = deriveScore(draftState);

  return draftState;
}
