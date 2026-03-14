import {
  brandColorForTheme,
  createFallbackLogoDataUrl,
  inferBrandTheme,
  startupMonogram,
} from "@/lib/ai/startup-branding";
import type {
  CityState,
  DistrictId,
  DistrictState,
  GeoPoint,
  PlayerChoiceEffect,
  PlayerChoiceOption,
  PlayerChoiceRound,
  PlayerStartupState,
  PlayerStartupStatus,
  PlayerStartupTheme,
  PlayerStrategyFocus,
  StartupParcelState,
} from "@/lib/types/city";
import { clamp } from "@/lib/utils";

import { createSeededRandom, randomId } from "./random";

const PLAYER_CHOICE_WINDOW_MS = 18_000;
const NEXT_PLAYER_CHOICE_MS = 10_000;

const PLAYER_FOCUS_WEIGHTS: Record<
  PlayerStrategyFocus,
  { capital: number; talent: number; compute: number; vibe: number; localBusiness: number }
> = {
  product: { capital: 0.26, talent: 0.5, compute: 0.46, vibe: 0.1, localBusiness: 0.12 },
  growth: { capital: 0.52, talent: 0.22, compute: 0.24, vibe: 0.2, localBusiness: 0.24 },
  sales: { capital: 0.34, talent: 0.24, compute: 0.08, vibe: 0.26, localBusiness: 0.48 },
  talent: { capital: 0.18, talent: 0.62, compute: 0.2, vibe: 0.08, localBusiness: 0.08 },
  community: { capital: 0.1, talent: 0.12, compute: 0.06, vibe: 0.56, localBusiness: 0.54 },
  compute: { capital: 0.18, talent: 0.24, compute: 0.66, vibe: 0.06, localBusiness: 0.05 },
};

type ChoiceScenario = {
  prompt: string;
  options: readonly [
    Omit<PlayerChoiceOption, "id">,
    Omit<PlayerChoiceOption, "id">,
  ];
};

const THEME_FOCUS: Record<PlayerStartupTheme, PlayerStrategyFocus> = {
  "ai-infra": "compute",
  robotics: "product",
  biotech: "talent",
  consumer: "community",
  fintech: "sales",
  commerce: "growth",
  design: "product",
  climate: "growth",
};

const THEME_SCENARIOS: Record<PlayerStartupTheme, readonly ChoiceScenario[]> = {
  "ai-infra": [
    {
      prompt: "{name} can chase a GPU-heavy enterprise design partner in {district}, or optimize for a lighter open beta. What should the AI do?",
      options: [
        {
          label: "Take the GPU pilot",
          description: "Bigger contract, bigger burn, faster tower growth if it lands.",
          outlook: "surge",
          effect: {
            focus: "compute",
            tractionDelta: 12,
            cashDelta: -10,
            growthDelta: 14,
            hypeDelta: 8,
            resilienceDelta: -5,
          },
        },
        {
          label: "Ship the lighter beta",
          description: "Stay lean, protect runway, and compound slower.",
          outlook: "stabilize",
          effect: {
            focus: "product",
            tractionDelta: 6,
            cashDelta: 7,
            growthDelta: 5,
            hypeDelta: 2,
            resilienceDelta: 8,
          },
        },
      ],
    },
    {
      prompt: "{name} is getting inbound from AI founders. Lean into credits and speed, or price for reliability?",
      options: [
        {
          label: "Burn for speed",
          description: "Explode usage quickly and risk a messy quarter.",
          outlook: "risk",
          effect: {
            focus: "growth",
            tractionDelta: 10,
            cashDelta: -12,
            growthDelta: 12,
            hypeDelta: 10,
            resilienceDelta: -6,
          },
        },
        {
          label: "Sell reliability",
          description: "Close slower revenue and steady the stack.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 7,
            cashDelta: 9,
            growthDelta: 6,
            hypeDelta: 3,
            resilienceDelta: 9,
          },
        },
      ],
    },
  ],
  robotics: [
    {
      prompt: "{name} has a chance to put hardware into the field. Take the fast warehouse pilot or harden the prototype?",
      options: [
        {
          label: "Launch the field pilot",
          description: "Real traction now, but one failure could hit survival.",
          outlook: "surge",
          effect: {
            focus: "product",
            tractionDelta: 13,
            cashDelta: -8,
            growthDelta: 11,
            hypeDelta: 7,
            resilienceDelta: -4,
          },
        },
        {
          label: "Harden the stack",
          description: "Trade momentum for a safer next month.",
          outlook: "stabilize",
          effect: {
            focus: "talent",
            tractionDelta: 4,
            cashDelta: 3,
            growthDelta: 5,
            hypeDelta: 1,
            resilienceDelta: 12,
          },
        },
      ],
    },
    {
      prompt: "{name} can spend on permits and space in Dogpatch, or pivot toward software revenue. What should happen next?",
      options: [
        {
          label: "Double down on hardware",
          description: "Keep the tower climbing if permits cooperate.",
          outlook: "surge",
          effect: {
            focus: "product",
            tractionDelta: 11,
            cashDelta: -10,
            growthDelta: 10,
            hypeDelta: 6,
            resilienceDelta: -3,
          },
        },
        {
          label: "Pivot to software ops",
          description: "Shrink the burn and survive the city longer.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 5,
            cashDelta: 8,
            growthDelta: 4,
            hypeDelta: 0,
            resilienceDelta: 10,
          },
        },
      ],
    },
  ],
  biotech: [
    {
      prompt: "{name} can chase a hospital partner now or stay in research mode a little longer. Which path should the AI take?",
      options: [
        {
          label: "Land the hospital partner",
          description: "A bigger swing that can unlock capital and pressure.",
          outlook: "surge",
          effect: {
            focus: "sales",
            tractionDelta: 12,
            cashDelta: -7,
            growthDelta: 10,
            hypeDelta: 6,
            resilienceDelta: -2,
          },
        },
        {
          label: "Stay in research mode",
          description: "Keep the science clean and extend survival.",
          outlook: "stabilize",
          effect: {
            focus: "talent",
            tractionDelta: 5,
            cashDelta: 6,
            growthDelta: 4,
            hypeDelta: 2,
            resilienceDelta: 10,
          },
        },
      ],
    },
    {
      prompt: "{name} has lab demand in Mission Bay. Hire expensive operators or keep a small elite team?",
      options: [
        {
          label: "Scale the lab team",
          description: "More speed and more risk.",
          outlook: "risk",
          effect: {
            focus: "talent",
            tractionDelta: 10,
            cashDelta: -11,
            growthDelta: 11,
            hypeDelta: 5,
            resilienceDelta: -5,
          },
        },
        {
          label: "Stay a focused crew",
          description: "Longer runway, slower climb.",
          outlook: "stabilize",
          effect: {
            focus: "product",
            tractionDelta: 5,
            cashDelta: 8,
            growthDelta: 4,
            hypeDelta: 1,
            resilienceDelta: 9,
          },
        },
      ],
    },
  ],
  consumer: [
    {
      prompt: "{name} is catching real nightlife energy. Throw a loud launch event or tighten retention loops first?",
      options: [
        {
          label: "Throw the launch event",
          description: "Higher hype and a steeper survival curve.",
          outlook: "surge",
          effect: {
            focus: "community",
            tractionDelta: 12,
            cashDelta: -9,
            growthDelta: 11,
            hypeDelta: 12,
            resilienceDelta: -5,
          },
        },
        {
          label: "Tighten retention first",
          description: "Protect the base before chasing the next block.",
          outlook: "stabilize",
          effect: {
            focus: "product",
            tractionDelta: 7,
            cashDelta: 5,
            growthDelta: 6,
            hypeDelta: 3,
            resilienceDelta: 8,
          },
        },
      ],
    },
    {
      prompt: "{name} can partner with local merchants now or chase pure consumer growth. What should the city see?",
      options: [
        {
          label: "Partner with merchants",
          description: "Better survival and slower top-line hype.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 8,
            cashDelta: 7,
            growthDelta: 6,
            hypeDelta: 2,
            resilienceDelta: 10,
          },
        },
        {
          label: "Chase pure consumer growth",
          description: "Huge upside if the vibe holds.",
          outlook: "surge",
          effect: {
            focus: "growth",
            tractionDelta: 12,
            cashDelta: -10,
            growthDelta: 13,
            hypeDelta: 11,
            resilienceDelta: -6,
          },
        },
      ],
    },
  ],
  fintech: [
    {
      prompt: "{name} has a shot at a bank design partner in {district}. Should the AI close enterprise now or build a self-serve wedge?",
      options: [
        {
          label: "Close enterprise now",
          description: "Revenue and status, but slower product loops.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 9,
            cashDelta: 10,
            growthDelta: 5,
            hypeDelta: 4,
            resilienceDelta: 8,
          },
        },
        {
          label: "Build the self-serve wedge",
          description: "Faster adoption if the city buys in.",
          outlook: "surge",
          effect: {
            focus: "growth",
            tractionDelta: 12,
            cashDelta: -9,
            growthDelta: 12,
            hypeDelta: 8,
            resilienceDelta: -5,
          },
        },
      ],
    },
    {
      prompt: "{name} can spend heavily on compliance to unlock larger customers, or keep it scrappy and move faster. What now?",
      options: [
        {
          label: "Buy the compliance edge",
          description: "Survive longer and sell higher.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 7,
            cashDelta: -4,
            growthDelta: 6,
            hypeDelta: 1,
            resilienceDelta: 12,
          },
        },
        {
          label: "Keep it scrappy",
          description: "A faster climb with more regulatory risk.",
          outlook: "risk",
          effect: {
            focus: "growth",
            tractionDelta: 11,
            cashDelta: 2,
            growthDelta: 10,
            hypeDelta: 7,
            resilienceDelta: -8,
          },
        },
      ],
    },
  ],
  commerce: [
    {
      prompt: "{name} is starting to pull customers through North Beach. Lean into merchant partnerships or paid acquisition?",
      options: [
        {
          label: "Lean into merchants",
          description: "Healthier neighborhood pull and steadier tower growth.",
          outlook: "stabilize",
          effect: {
            focus: "community",
            tractionDelta: 8,
            cashDelta: 8,
            growthDelta: 6,
            hypeDelta: 3,
            resilienceDelta: 9,
          },
        },
        {
          label: "Pour cash into acquisition",
          description: "Bigger upside if the city keeps the vibe alive.",
          outlook: "surge",
          effect: {
            focus: "growth",
            tractionDelta: 13,
            cashDelta: -12,
            growthDelta: 12,
            hypeDelta: 8,
            resilienceDelta: -5,
          },
        },
      ],
    },
    {
      prompt: "{name} can launch concierge service now or productize the experience first. Which route should the AI choose?",
      options: [
        {
          label: "Launch concierge now",
          description: "Faster revenue and more operational load.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 9,
            cashDelta: 6,
            growthDelta: 5,
            hypeDelta: 2,
            resilienceDelta: 8,
          },
        },
        {
          label: "Productize first",
          description: "A slower ramp toward a taller future tower.",
          outlook: "surge",
          effect: {
            focus: "product",
            tractionDelta: 7,
            cashDelta: -5,
            growthDelta: 10,
            hypeDelta: 5,
            resilienceDelta: 4,
          },
        },
      ],
    },
  ],
  design: [
    {
      prompt: "{name} can keep the brand exquisitely tight or chase broader demand through adjacent services. What should the AI do next?",
      options: [
        {
          label: "Protect the premium brand",
          description: "Higher resilience and slower scale.",
          outlook: "stabilize",
          effect: {
            focus: "product",
            tractionDelta: 7,
            cashDelta: 7,
            growthDelta: 5,
            hypeDelta: 5,
            resilienceDelta: 9,
          },
        },
        {
          label: "Expand into services",
          description: "More upside if execution holds.",
          outlook: "surge",
          effect: {
            focus: "growth",
            tractionDelta: 11,
            cashDelta: -8,
            growthDelta: 10,
            hypeDelta: 6,
            resilienceDelta: -3,
          },
        },
      ],
    },
    {
      prompt: "{name} can go all in on Hayes Valley operators or stay a tiny artful team. Which choice drives the skyline?",
      options: [
        {
          label: "Hire the operators",
          description: "More reach, more burn.",
          outlook: "risk",
          effect: {
            focus: "talent",
            tractionDelta: 10,
            cashDelta: -10,
            growthDelta: 9,
            hypeDelta: 4,
            resilienceDelta: -4,
          },
        },
        {
          label: "Stay tiny and sharp",
          description: "Preserve cash and keep the culture intact.",
          outlook: "stabilize",
          effect: {
            focus: "community",
            tractionDelta: 6,
            cashDelta: 9,
            growthDelta: 4,
            hypeDelta: 4,
            resilienceDelta: 10,
          },
        },
      ],
    },
  ],
  climate: [
    {
      prompt: "{name} can chase a city pilot now or build a stronger neighborhood wedge first. Which path should the AI take?",
      options: [
        {
          label: "Chase the city pilot",
          description: "A tall upside with slower procurement risk.",
          outlook: "surge",
          effect: {
            focus: "growth",
            tractionDelta: 10,
            cashDelta: -8,
            growthDelta: 11,
            hypeDelta: 6,
            resilienceDelta: -3,
          },
        },
        {
          label: "Build the neighborhood wedge",
          description: "Steadier cash and stronger local fit.",
          outlook: "stabilize",
          effect: {
            focus: "community",
            tractionDelta: 8,
            cashDelta: 7,
            growthDelta: 6,
            hypeDelta: 3,
            resilienceDelta: 9,
          },
        },
      ],
    },
    {
      prompt: "{name} can spend on hardware deployment or sell software first. What happens next in the city?",
      options: [
        {
          label: "Deploy the hardware",
          description: "Big physical presence and a hotter risk curve.",
          outlook: "risk",
          effect: {
            focus: "product",
            tractionDelta: 11,
            cashDelta: -11,
            growthDelta: 10,
            hypeDelta: 5,
            resilienceDelta: -6,
          },
        },
        {
          label: "Sell software first",
          description: "Keep the company alive and compound.",
          outlook: "stabilize",
          effect: {
            focus: "sales",
            tractionDelta: 7,
            cashDelta: 8,
            growthDelta: 6,
            hypeDelta: 2,
            resilienceDelta: 9,
          },
        },
      ],
    },
  ],
};

const STARTUP_MOODS = {
  breakout: "The skyline is compounding. Everyone can see the tower pulling away.",
  distressed: "The company is flickering. One bad decision and the lights go out.",
  dead: "The parcel has gone dark and the startup collapsed.",
  steady: "Still alive, still compounding, still in the game.",
  growing: "Demand is visible. The block is starting to believe.",
  launching: "Fresh in the city, still trying to become real.",
} satisfies Record<PlayerStartupStatus, string>;

type AmbientSeed = {
  districtId: DistrictId;
  name: string;
  description: string;
};

const AMBIENT_STARTUPS: readonly AmbientSeed[] = [
  { districtId: "soma", name: "Tensor Wharf", description: "GPU ops for lean AI founders moving too fast for normal tooling." },
  { districtId: "soma", name: "Prompt Ledger", description: "AI workflow billing for infra teams with ugly cost curves." },
  { districtId: "fidi", name: "Yield Signal", description: "Treasury automation for volatile startup cash." },
  { districtId: "fidi", name: "Cap Table Bay", description: "Finance workflows for operators running post-seed chaos." },
  { districtId: "mission", name: "Sidewalk Loop", description: "Neighborhood loyalty and event loops for local merchants." },
  { districtId: "mission", name: "Night Current", description: "Consumer community layer for repeat real-world hangouts." },
  { districtId: "hayes", name: "Studio Cart", description: "Design-forward commerce tools for boutique operators." },
  { districtId: "hayes", name: "Gallery Mode", description: "Retail storytelling software for visually obsessive brands." },
  { districtId: "dogpatch", name: "Forge Grid", description: "Robotics operating system for warehouses and port logistics." },
  { districtId: "dogpatch", name: "Atlas Servo", description: "Industrial autonomy for teams stuck in pilot purgatory." },
  { districtId: "mission-bay", name: "Trial Current", description: "Biotech workflow tools connecting wet labs and software." },
  { districtId: "mission-bay", name: "Vector Bloom", description: "Clinical intelligence for research teams under timing pressure." },
  { districtId: "north-beach", name: "Harbor Social", description: "Merchant-friendly social discovery for dining and nightlife." },
  { districtId: "north-beach", name: "Windowline", description: "Local storefront demand shaping for consumer brands." },
  { districtId: "sunset-richmond", name: "Tide Loop", description: "Climate resilience software for neighborhood-scale systems." },
  { districtId: "sunset-richmond", name: "Fog Grid", description: "Community energy coordination for dense residential blocks." },
] as const;

function metersToLat(meters: number) {
  return meters / 111_320;
}

function metersToLng(meters: number, latitude: number) {
  return meters / (111_320 * Math.cos((latitude * Math.PI) / 180));
}

function createFootprint(center: GeoPoint, widthMeters: number, depthMeters: number) {
  const latOffset = metersToLat(depthMeters / 2);
  const lngOffset = metersToLng(widthMeters / 2, center.lat);

  return [
    { lng: center.lng - lngOffset, lat: center.lat - latOffset },
    { lng: center.lng + lngOffset, lat: center.lat - latOffset },
    { lng: center.lng + lngOffset, lat: center.lat + latOffset },
    { lng: center.lng - lngOffset, lat: center.lat + latOffset },
    { lng: center.lng - lngOffset, lat: center.lat - latOffset },
  ];
}

function createParcel(center: GeoPoint, districtId: DistrictId, label: string, lane: number, kind: "district" | "player") {
  return {
    id: `${kind}-${districtId}-${lane}`,
    districtId,
    label,
    center,
    footprint: createFootprint(center, kind === "district" ? 340 : 170, kind === "district" ? 260 : 132),
    lane,
    kind,
  } satisfies StartupParcelState;
}

export function createStartupParcels(districts: Record<DistrictId, DistrictState>) {
  const parcels: StartupParcelState[] = [];

  for (const district of Object.values(districts)) {
    const districtOffsets = [
      { east: -130, north: 96 },
      { east: 0, north: 78 },
      { east: 120, north: 54 },
      { east: -64, north: -22 },
    ];
    const playerOffsets = [
      { east: 118, north: 122 },
      { east: 164, north: 40 },
      { east: 112, north: -62 },
      { east: 12, north: -122 },
      { east: -128, north: -98 },
      { east: -170, north: 12 },
    ];

    districtOffsets.forEach((offset, index) => {
      const center = {
        lng: district.geo.lng + metersToLng(offset.east, district.geo.lat),
        lat: district.geo.lat + metersToLat(offset.north),
      };
      parcels.push(createParcel(center, district.id, `${district.label} Core ${index + 1}`, index, "district"));
    });

    playerOffsets.forEach((offset, index) => {
      const center = {
        lng: district.geo.lng + metersToLng(offset.east, district.geo.lat),
        lat: district.geo.lat + metersToLat(offset.north),
      };
      parcels.push(createParcel(center, district.id, `${district.label} Startup ${index + 1}`, index, "player"));
    });
  }

  return parcels;
}

function parcelForStartup(
  districtId: DistrictId,
  startupParcels: StartupParcelState[],
  existing: PlayerStartupState[],
) {
  const occupied = new Set(existing.map((startup) => startup.parcelId));
  return startupParcels.find(
    (parcel) =>
      parcel.kind === "player" &&
      parcel.districtId === districtId &&
      !occupied.has(parcel.id),
  ) ?? startupParcels.find((parcel) => parcel.kind === "player" && parcel.districtId === districtId) ?? null;
}

function describeEffect(effect: PlayerChoiceEffect) {
  if (effect.focus === "compute") {
    return "The AI is leaning into pure speed and infrastructure dominance.";
  }
  if (effect.focus === "community") {
    return "The AI is turning street-level demand into durable pull.";
  }
  if (effect.focus === "sales") {
    return "The AI is tightening the route to revenue.";
  }
  if (effect.focus === "talent") {
    return "The AI is trading short-term height for a stronger team.";
  }
  if (effect.focus === "growth") {
    return "The AI is pushing for visible tower growth across the next block.";
  }
  return "The AI is staying close to the product and learning in the market.";
}

function themeFromDistrict(districtId: DistrictId): PlayerStartupTheme {
  const byDistrict = {
    soma: "ai-infra",
    fidi: "fintech",
    mission: "consumer",
    hayes: "design",
    dogpatch: "robotics",
    "mission-bay": "biotech",
    "north-beach": "commerce",
    "sunset-richmond": "climate",
  } satisfies Record<DistrictId, PlayerStartupTheme>;

  return byDistrict[districtId];
}

function initialFocus(theme: PlayerStartupTheme) {
  return THEME_FOCUS[theme];
}

function createChoiceRound(
  startup: PlayerStartupState,
  district: DistrictState,
  elapsedMs: number,
  seed: string,
): PlayerChoiceRound {
  const random = createSeededRandom(`${seed}:${startup.id}:${elapsedMs}:choice`);
  const scenarios = THEME_SCENARIOS[startup.theme];
  const scenario = scenarios[Math.floor(random() * scenarios.length)] ?? scenarios[0];

  return {
    id: randomId("round", random, 6),
    prompt: scenario.prompt
      .replaceAll("{name}", startup.name)
      .replaceAll("{district}", district.label)
      .replaceAll("{description}", startup.description),
    opensAt: elapsedMs,
    closesAt: elapsedMs + PLAYER_CHOICE_WINDOW_MS,
    options: scenario.options.map((template) => ({
      ...template,
      id: randomId("choice", random, 5),
    })),
    selectedOptionId: null,
    resolvedOptionId: null,
  };
}

function focusFit(startup: PlayerStartupState, district: DistrictState) {
  const weights = PLAYER_FOCUS_WEIGHTS[startup.strategyFocus];
  return (
    district.stats.capital * weights.capital +
    district.stats.talent * weights.talent +
    district.stats.compute * weights.compute +
    district.stats.vibe * weights.vibe +
    district.stats.localBusiness * weights.localBusiness
  ) / 1.6;
}

function deriveHeight(startup: PlayerStartupState) {
  const baseHeight = startup.controlMode === "ambient" ? 180 : 230;
  const statusBoost =
    startup.status === "breakout"
      ? 320
      : startup.status === "distressed"
        ? -60
        : startup.status === "dead"
          ? -150
          : startup.status === "growing"
            ? 120
            : startup.status === "steady"
              ? 54
              : 0;

  return clamp(
    baseHeight +
      startup.traction * 3.1 +
      startup.growth * 3 +
      startup.hype * 1.8 +
      startup.resilience * 0.8 +
      statusBoost,
    52,
    920,
  );
}

function deriveValuation(startup: PlayerStartupState) {
  return Math.round(
    clamp(startup.traction * 1.2 + startup.growth * 1.45 + startup.cash * 0.8 + startup.hype, 12, 420),
  );
}

function deriveStatus(startup: PlayerStartupState): PlayerStartupStatus {
  if (startup.cash <= 0 || startup.traction <= 0 || startup.resilience <= 0) {
    return "dead";
  }
  if (startup.traction > 84 && startup.growth > 74 && startup.cash > 18) {
    return "breakout";
  }
  if (startup.cash < 14 || startup.traction < 22 || startup.resilience < 12) {
    return "distressed";
  }
  if (startup.growth > 58 || startup.traction > 56) {
    return "growing";
  }
  if (startup.foundedAt < 10_000) {
    return "launching";
  }
  return "steady";
}

function cloneRound(round: PlayerChoiceRound) {
  return {
    ...round,
    options: round.options.map((option) => ({ ...option, effect: { ...option.effect } })),
  };
}

function resolveChoiceRound(startup: PlayerStartupState, elapsedMs: number) {
  const round = startup.activeChoiceRound;
  if (!round) {
    return startup;
  }

  const selected =
    round.options.find((option) => option.id === round.selectedOptionId) ??
    round.options.find((option) => option.outlook === "stabilize") ??
    round.options[0];

  if (!selected) {
    startup.activeChoiceRound = null;
    startup.nextChoiceAt = elapsedMs + NEXT_PLAYER_CHOICE_MS;
    return startup;
  }

  startup.strategyFocus = selected.effect.focus;
  startup.traction = clamp(startup.traction + selected.effect.tractionDelta, 0, 100);
  startup.cash = clamp(startup.cash + selected.effect.cashDelta, 0, 100);
  startup.growth = clamp(startup.growth + selected.effect.growthDelta, 0, 100);
  startup.hype = clamp(startup.hype + selected.effect.hypeDelta, 0, 100);
  startup.resilience = clamp(startup.resilience + selected.effect.resilienceDelta, 0, 100);
  startup.aiAction = describeEffect(selected.effect);

  const resolvedRound: PlayerChoiceRound = {
    ...cloneRound(round),
    resolvedOptionId: selected.id,
  };

  startup.resolvedChoices = [resolvedRound, ...startup.resolvedChoices].slice(0, 6);
  startup.activeChoiceRound = null;
  startup.nextChoiceAt = elapsedMs + NEXT_PLAYER_CHOICE_MS;
  return startup;
}

function buildStartup(args: {
  city: CityState;
  ownerUserId: string;
  ownerLabel: string;
  name: string;
  description: string;
  districtId: DistrictId;
  controlMode: "player" | "ambient";
  theme?: PlayerStartupTheme;
  brandColor?: string;
  logoDataUrl?: string | null;
  traction?: number;
  cash?: number;
  growth?: number;
  hype?: number;
  resilience?: number;
}) {
  const random = createSeededRandom(`${args.city.seed}:${args.ownerUserId}:${args.name}`);
  const parcel = parcelForStartup(args.districtId, args.city.startupParcels, args.city.playerStartups);
  if (!parcel) {
    throw new Error("No startup parcel available in this district.");
  }

  const theme = args.theme ?? inferBrandTheme(args.description, args.districtId) ?? themeFromDistrict(args.districtId);
  const brandColor = args.brandColor ?? brandColorForTheme(theme);
  const monogram = startupMonogram(args.name);
  const focus = initialFocus(theme);

  const startup: PlayerStartupState = {
    id: randomId("startup", random, 7),
    ownerUserId: args.ownerUserId,
    ownerLabel: args.ownerLabel,
    controlMode: args.controlMode,
    name: args.name,
    description: args.description,
    theme,
    brandColor,
    logoMonogram: monogram,
    logoDataUrl: args.logoDataUrl ?? (args.controlMode === "ambient" ? createFallbackLogoDataUrl(args.name, brandColor) : null),
    districtId: args.districtId,
    parcelId: parcel.id,
    buildingHeight: 40,
    valuation: 30,
    traction: args.traction ?? (args.controlMode === "ambient" ? 46 : 30),
    cash: args.cash ?? (args.controlMode === "ambient" ? 58 : 46),
    growth: args.growth ?? (args.controlMode === "ambient" ? 42 : 24),
    hype: args.hype ?? (args.controlMode === "ambient" ? 35 : 18),
    resilience: args.resilience ?? (args.controlMode === "ambient" ? 48 : 42),
    status: "launching",
    strategyFocus: focus,
    aiMood: STARTUP_MOODS.launching,
    aiAction: args.controlMode === "ambient"
      ? "Already live on the block and compounding with the city."
      : "Freshly incorporated and waiting for the first move.",
    foundedAt: args.city.elapsedMs,
    nextChoiceAt: args.city.elapsedMs + (args.controlMode === "ambient" ? 120_000 : 4_500),
    activeChoiceRound: null,
    resolvedChoices: [],
  };

  startup.status = deriveStatus(startup);
  startup.buildingHeight = deriveHeight(startup);
  startup.valuation = deriveValuation(startup);
  startup.aiMood = STARTUP_MOODS[startup.status];
  return startup;
}

export function createPlayerStartup(args: {
  city: CityState;
  ownerUserId: string;
  ownerLabel: string;
  name: string;
  description: string;
  districtId: DistrictId;
  logoDataUrl?: string | null;
}) {
  return buildStartup({
    ...args,
    controlMode: "player",
    theme: inferBrandTheme(args.description, args.districtId),
  });
}

export function seedAmbientPlayerStartups(city: CityState) {
  return AMBIENT_STARTUPS.map((seed, index) =>
    buildStartup({
      city,
      ownerUserId: `ambient-${index + 1}`,
      ownerLabel: "City sim",
      name: seed.name,
      description: seed.description,
      districtId: seed.districtId,
      controlMode: "ambient",
      traction: 38 + (index % 5) * 8,
      cash: 44 + (index % 4) * 7,
      growth: 30 + (index % 6) * 7,
      hype: 18 + (index % 5) * 6,
      resilience: 34 + (index % 4) * 8,
    }),
  );
}

export function submitPlayerChoice(
  startup: PlayerStartupState,
  choiceRoundId: string,
  optionId: string,
) {
  if (!startup.activeChoiceRound || startup.activeChoiceRound.id !== choiceRoundId) {
    return startup;
  }

  startup.activeChoiceRound.selectedOptionId = optionId;
  return startup;
}

export function resolvePlayerChoiceNow(
  startup: PlayerStartupState,
  state: CityState,
  choiceRoundId: string,
  optionId: string,
) {
  if (!startup.activeChoiceRound || startup.activeChoiceRound.id !== choiceRoundId) {
    return startup;
  }

  submitPlayerChoice(startup, choiceRoundId, optionId);
  resolveChoiceRound(startup, state.elapsedMs);

  startup.status = deriveStatus(startup);
  startup.buildingHeight = deriveHeight(startup);
  startup.valuation = deriveValuation(startup);
  startup.aiMood = STARTUP_MOODS[startup.status];

  if (startup.status !== "dead" && startup.status !== "breakout") {
    const district = state.districts[startup.districtId];
    startup.activeChoiceRound = createChoiceRound(startup, district, state.elapsedMs + 250, state.seed);
    startup.nextChoiceAt = startup.activeChoiceRound.opensAt;
  }

  return startup;
}

export function advancePlayerStartups(state: CityState, elapsedMs: number, deltaMs: number) {
  const deltaScale = deltaMs / 1000;

  state.playerStartups = state.playerStartups.map((startup) => {
    const district = state.districts[startup.districtId];
    const next: PlayerStartupState = {
      ...startup,
      resolvedChoices: startup.resolvedChoices.map(cloneRound),
      activeChoiceRound: startup.activeChoiceRound ? cloneRound(startup.activeChoiceRound) : null,
    };

    if (next.status === "dead" || next.status === "breakout") {
      next.buildingHeight = deriveHeight(next);
      next.valuation = deriveValuation(next);
      next.aiMood = STARTUP_MOODS[next.status];
      return next;
    }

    const fit = focusFit(next, district);
    const startupDensity = state.playerStartups.filter(
      (entry) => entry.districtId === next.districtId && entry.id !== next.id && entry.status !== "dead",
    ).length;

    const tractionDelta =
      (fit / 48 -
        district.stats.congestion / 44 +
        district.stats.localBusiness / 170 +
        district.stats.vibe / 210 -
        startupDensity * 0.26) *
      deltaScale;
    const cashDelta =
      (-1.9 +
        district.stats.capital / 15 +
        next.resilience / 28 -
        district.stats.rentPressure / 36 -
        startupDensity * 0.12) *
      deltaScale;
    const growthDelta =
      (fit / 62 +
        next.hype / 86 -
        district.stats.permits / 140 +
        district.stats.compute / 210) *
      deltaScale;
    const hypeDelta =
      (district.stats.vibe / 24 + next.traction / 74 - district.stats.rentPressure / 92) *
      deltaScale;

    next.traction = clamp(next.traction + tractionDelta, 0, 100);
    next.cash = clamp(next.cash + cashDelta, 0, 100);
    next.growth = clamp(next.growth + growthDelta, 0, 100);
    next.hype = clamp(next.hype + hypeDelta, 0, 100);

    if (next.activeChoiceRound && elapsedMs >= next.activeChoiceRound.closesAt) {
      resolveChoiceRound(next, elapsedMs);
    }

    if (
      next.controlMode === "player" &&
      !next.activeChoiceRound &&
      elapsedMs >= next.nextChoiceAt
    ) {
      next.activeChoiceRound = createChoiceRound(next, district, elapsedMs, state.seed);
    }

    next.status = deriveStatus(next);
    next.buildingHeight = deriveHeight(next);
    next.valuation = deriveValuation(next);
    next.aiMood = STARTUP_MOODS[next.status];

    if (next.status === "distressed" && next.activeChoiceRound === null) {
      next.aiAction = "The AI is scrambling for survival while rent pressure climbs.";
    } else if (next.status === "growing") {
      next.aiAction = "The AI found product pull and the tower is visibly climbing.";
    } else if (next.status === "breakout") {
      next.aiAction = "This tower is now one of the dominant signals in the city.";
    } else if (next.status === "dead") {
      next.aiAction = "The company ran out of room and the block went dark.";
    }

    return next;
  });
}

export function buildPlayerStartupOutcomes(state: CityState) {
  return state.playerStartups
    .filter((startup) => startup.controlMode === "player")
    .map((startup) => {
      const district = state.districts[startup.districtId];
      const outcome =
        startup.status === "breakout"
          ? "broke out"
          : startup.status === "dead"
            ? "collapsed"
            : startup.status === "distressed"
              ? "barely held on"
              : "kept climbing";

      return `${startup.name} ${outcome} in ${district.label} and ended at ${Math.round(startup.buildingHeight)}m.`;
    });
}
