import type { CityState, FounderAgentState, ManagerAgentState } from "@/lib/types/city";

function summarizeDistricts(state: CityState) {
  return Object.values(state.districts)
    .map((district) => {
      const stats = district.stats;
      return `${district.label}: capital ${Math.round(stats.capital)}, talent ${Math.round(
        stats.talent,
      )}, compute ${Math.round(stats.compute)}, permits ${Math.round(
        stats.permits,
      )}, vibe ${Math.round(stats.vibe)}, localBusiness ${Math.round(
        stats.localBusiness,
      )}, congestion ${Math.round(stats.congestion)}, rent ${Math.round(
        stats.rentPressure,
      )}`;
    })
    .join("\n");
}

function summarizeFounders(state: CityState) {
  return state.founders
    .map((founder) => {
      const needs = founder.needs
        .map((need) => `${need}:${Math.round(founder.resourceProgress[need])}`)
        .join(", ");

      return `${founder.name} (${founder.companyType}) in ${state.districts[founder.currentDistrict].label} -> ${state.districts[founder.targetDistrict].label}; status ${founder.status}; runway ${Math.round(founder.runway)}; progress ${needs}`;
    })
    .join("\n");
}

export function buildFounderPrompt(state: CityState, founder: FounderAgentState) {
  return {
    instructions: [
      "You are a founder agent in Founder City, a satirical multiplayer city sim set in San Francisco.",
      "Return only a JSON object that matches the required founder decision schema.",
      "Make a single practical decision that is visible on the board in under 15 seconds.",
      "Prefer short, legible speech bubbles and grounded reasons.",
    ].join(" "),
    input: [
      `Current city score: ${JSON.stringify(state.score)}`,
      "District snapshot:",
      summarizeDistricts(state),
      "Founder roster:",
      summarizeFounders(state),
      `You are ${founder.name}.`,
      `Pitch: ${founder.pitch}`,
      `Temperament: ${founder.temperament}`,
      `Current district: ${state.districts[founder.currentDistrict].label}`,
      `Target district: ${state.districts[founder.targetDistrict].label}`,
      `Status: ${founder.status}`,
      `Runway: ${Math.round(founder.runway)}`,
      `Needs: ${founder.needs.join(", ")}`,
      `Recent memory: ${founder.memory.slice(0, 3).join(" | ")}`,
      "Pick one action: reroute, pivot, stall, relocate, breakout.",
    ].join("\n"),
  };
}

export function buildManagerPrompt(state: CityState, manager: ManagerAgentState) {
  return {
    instructions: [
      "You are a city manager agent in Founder City, a live city operations simulator.",
      "Return only a JSON object that matches the required manager decision schema.",
      "Your recommendation should be visible to players and tie to one district.",
      "Do not narrate beyond the schema fields.",
    ].join(" "),
    input: [
      `Department: ${manager.department}`,
      `Manager name: ${manager.name}`,
      `Current city score: ${JSON.stringify(state.score)}`,
      "District snapshot:",
      summarizeDistricts(state),
      "Founder roster:",
      summarizeFounders(state),
      `Current manager focus: ${state.districts[manager.targetDistrict].label}`,
      `Current speech bubble: ${manager.speechBubble}`,
      "Pick one recommendation type: watchlist, reroute, grant, festival, fast-track.",
    ].join("\n"),
  };
}

export function buildPulsePrompt(state: CityState) {
  return {
    instructions: [
      "You are the City Pulse scout agent in Founder City.",
      "Return only a JSON object that matches the required pulse decision schema.",
      "Emit one event that can be turned into an event card immediately.",
      "Keep the headline and ticker sharp and stage-readable.",
    ].join(" "),
    input: [
      `Current city score: ${JSON.stringify(state.score)}`,
      "District snapshot:",
      summarizeDistricts(state),
      "Founder roster:",
      summarizeFounders(state),
      `Latest ticker: ${state.ticker.join(" | ")}`,
      "Choose one event type: permit-freeze, muni-disruption, founder-dinner, demo-week, cloud-credit-frenzy, rent-shock.",
    ].join("\n"),
  };
}
