import type { CityState, DistrictId, EventCard } from "@/lib/types/city";
import { clamp } from "@/lib/utils";

import { createSeededRandom, pickMany, shuffle } from "./random";

type EventBlueprint = Omit<EventCard, "affectedDistricts" | "id" | "triggeredAt"> & {
  defaultDistricts: DistrictId[];
};

const EVENT_BLUEPRINTS: readonly EventBlueprint[] = [
  {
    title: "Permit Freeze",
    eventType: "permit-freeze",
    description:
      "A backlog spike in approvals strands launch-ready teams outside the city gates.",
    tickerCopy: "City Hall gridlock is forcing founders into permit limbo.",
    effect: {
      permits: -24,
      congestion: 10,
      vibe: -5,
    },
    defaultDistricts: ["mission-bay", "dogpatch"],
  },
  {
    title: "MUNI Disruption",
    eventType: "muni-disruption",
    description:
      "Transit reliability falls apart and commute time starts eating startup focus.",
    tickerCopy: "A MUNI disruption is jamming the city spine.",
    effect: {
      congestion: 18,
      talent: -6,
      vibe: -4,
    },
    defaultDistricts: ["soma", "mission", "hayes"],
  },
  {
    title: "Founder Dinner Surge",
    eventType: "founder-dinner",
    description:
      "A hype wave of dinners and side-events drives foot traffic into nightlife districts.",
    tickerCopy: "Founder dinners are pumping customer flow into the night corridor.",
    effect: {
      vibe: 16,
      localBusiness: 12,
      congestion: 6,
    },
    defaultDistricts: ["north-beach", "mission"],
  },
  {
    title: "Demo Week Spike",
    eventType: "demo-week",
    description:
      "Investors, talent, and founders converge at once, stressing the city while raising attention.",
    tickerCopy: "Demo Week is turning downtown into a founder pressure cooker.",
    effect: {
      capital: 10,
      talent: 9,
      congestion: 14,
      rentPressure: 8,
    },
    defaultDistricts: ["soma", "fidi"],
  },
  {
    title: "Cloud Credit Frenzy",
    eventType: "cloud-credit-frenzy",
    description:
      "Free compute floods the hottest blocks, supercharging infra bets and overheating demand.",
    tickerCopy: "A cloud-credit frenzy is pulling teams toward compute-heavy districts.",
    effect: {
      compute: 18,
      capital: 8,
      rentPressure: 11,
    },
    defaultDistricts: ["soma", "dogpatch"],
  },
  {
    title: "Rent Shock",
    eventType: "rent-shock",
    description:
      "Commercial and housing costs jump together, squeezing local businesses and founder runway.",
    tickerCopy: "Rent shock is pushing neighborhood resilience to the brink.",
    effect: {
      rentPressure: 18,
      localBusiness: -14,
      vibe: -10,
    },
    defaultDistricts: ["mission", "hayes", "soma"],
  },
] as const;

export const EVENT_TEMPLATES: readonly EventCard[] = EVENT_BLUEPRINTS.map(
  (blueprint, index) => ({
    id: `event-template-${index + 1}`,
    title: blueprint.title,
    eventType: blueprint.eventType,
    description: blueprint.description,
    tickerCopy: blueprint.tickerCopy,
    affectedDistricts: [...blueprint.defaultDistricts],
    effect: blueprint.effect,
    triggeredAt: 0,
  }),
);

function districtPriority(state: CityState, eventType: EventCard["eventType"]) {
  const districts = Object.values(state.districts);

  const byDescending = (
    selector: (district: (typeof districts)[number]) => number,
  ) => [...districts].sort((left, right) => selector(right) - selector(left));

  switch (eventType) {
    case "permit-freeze":
      return byDescending(
        (district) => district.stats.compute + district.stats.capital - district.stats.permits,
      );
    case "muni-disruption":
      return byDescending((district) => district.stats.congestion + district.stats.talent);
    case "founder-dinner":
      return byDescending((district) => district.stats.vibe + district.stats.localBusiness);
    case "demo-week":
      return byDescending((district) => district.stats.capital + district.stats.compute);
    case "cloud-credit-frenzy":
      return byDescending((district) => district.stats.compute + district.stats.talent);
    case "rent-shock":
      return byDescending(
        (district) => district.stats.rentPressure + district.stats.capital + district.stats.vibe,
      );
    default:
      return districts;
  }
}

function pickAffectedDistricts(
  state: CityState,
  template: EventCard,
  triggeredAt: number,
) {
  const random = createSeededRandom(
    `${state.seed}:${template.eventType}:${triggeredAt}`,
  );
  const desiredCount = clamp(template.affectedDistricts.length, 1, 3);
  const ranked = districtPriority(state, template.eventType)
    .map((district) => district.id)
    .filter((districtId) => districtId !== "sunset-richmond" || template.eventType !== "demo-week");

  const combined = [
    ...template.affectedDistricts,
    ...ranked.filter((districtId) => !template.affectedDistricts.includes(districtId)),
  ];

  return pickMany(combined, desiredCount, random);
}

export function createEventDeck(seed: string) {
  const firstPass = shuffle(EVENT_TEMPLATES, createSeededRandom(`${seed}:events:1`));
  const secondPass = shuffle(EVENT_TEMPLATES, createSeededRandom(`${seed}:events:2`));

  return [...firstPass, ...secondPass].map((event, index) => ({
    ...event,
    id: `event-${index + 1}`,
  }));
}

export function materializeEventCard(
  template: EventCard,
  state: CityState,
  triggeredAt: number,
): EventCard {
  return {
    ...template,
    id: `${template.id}-${triggeredAt}`,
    affectedDistricts: pickAffectedDistricts(state, template, triggeredAt),
    triggeredAt,
  };
}
