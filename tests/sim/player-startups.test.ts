import { describe, expect, it } from "vitest";

import { advanceCityState } from "@/lib/sim/engine";
import { createInitialCityState } from "@/lib/sim/graph";
import { createPlayerStartup, resolvePlayerChoiceNow } from "@/lib/sim/player-startups";

describe("player startup simulation", () => {
  it("creates a startup parcel inside the shared city", () => {
    const city = createInitialCityState("player-seed", "room-1", "run-1");
    const startup = createPlayerStartup({
      city,
      ownerUserId: "player-1",
      ownerLabel: "Player 1",
      name: "Signal Foundry",
      description: "AI workflow stack for neighborhood logistics and local merchants.",
      districtId: "soma",
    });

    expect(startup.parcelId).toContain("player-soma");
    expect(startup.buildingHeight).toBeGreaterThan(0);
    expect(startup.activeChoiceRound).toBeNull();
  });

  it("opens a timed choice round and immediately rolls into the next choice after a selection", () => {
    const city = createInitialCityState("player-seed", "room-1", "run-1");
    const startup = createPlayerStartup({
      city,
      ownerUserId: "player-1",
      ownerLabel: "Player 1",
      name: "Signal Foundry",
      description: "AI workflow stack for neighborhood logistics and local merchants.",
      districtId: "soma",
    });
    city.playerStartups.push(startup);

    const withChoiceRound = advanceCityState(city, 8_000);
    const liveStartup = withChoiceRound.playerStartups.find(
      (entry) => entry.ownerUserId === "player-1",
    );

    expect(liveStartup?.activeChoiceRound).not.toBeNull();

    const selectedOption = liveStartup?.activeChoiceRound?.options[0];
    expect(selectedOption).toBeDefined();

    resolvePlayerChoiceNow(
      liveStartup!,
      withChoiceRound,
      liveStartup!.activeChoiceRound!.id,
      selectedOption!.id,
    );

    expect(liveStartup?.resolvedChoices.length).toBeGreaterThan(0);
    expect(liveStartup?.strategyFocus).toBe(selectedOption?.effect.focus);
    expect(liveStartup?.activeChoiceRound).not.toBeNull();
  });
});
