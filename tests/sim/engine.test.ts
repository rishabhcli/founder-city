import { describe, expect, it } from "vitest";

import { advanceCityState, applyVoteResolution, createRunSummary } from "@/lib/sim/engine";
import { createInitialCityState, findShortestPath } from "@/lib/sim/graph";
import { deriveScore } from "@/lib/sim/scoring";

describe("Founder City simulation engine", () => {
  it("builds deterministic shortest paths across the district graph", () => {
    expect(findShortestPath("dogpatch", "berkeley")).toEqual([
      "dogpatch",
      "soma",
      "fidi",
      "berkeley",
    ]);
  });

  it("opens a vote round and applies the winning intervention", () => {
    const initialState = createInitialCityState("demo-seed", "room-1", "run-1");
    const withVote = advanceCityState(initialState, 20_000);

    expect(withVote.activeVoteRound).not.toBeNull();

    const voteRound = withVote.activeVoteRound!;
    const winningOption = voteRound.options[1] ?? voteRound.options[0];
    voteRound.tallies[winningOption.id] = 9;

    const resolved = applyVoteResolution(withVote, voteRound);

    expect(resolved.activeVoteRound).toBeNull();
    expect(resolved.resolvedVotes).toHaveLength(1);
    expect(resolved.interventions).toHaveLength(1);
    expect(resolved.resolvedVotes[0]?.resolvedOptionId).toBe(winningOption.id);
  });

  it("advances founders, updates scores, and generates an end-of-run summary", () => {
    const initialState = createInitialCityState("demo-seed", "room-1", "run-1");
    const midRunState = advanceCityState(initialState, 12_000);

    expect(midRunState.founders.some((founder) => founder.routeProgress > 0)).toBe(true);
    expect(deriveScore(midRunState).startupSurvival).toBeGreaterThan(0);

    const endedState = advanceCityState(midRunState, 150_000);

    expect(endedState.status).toBe("ended");
    expect(endedState.summary).not.toBeNull();
    expect(endedState.summary?.headline.length).toBeGreaterThan(20);
    expect(createRunSummary(endedState).founderOutcomes).toHaveLength(5);
  });
});
