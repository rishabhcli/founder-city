import { NextRequest, NextResponse } from "next/server";
import { getRunByRunId, setRunCheckpoint } from "@/lib/data/store";
import { parseRequestBody } from "@/lib/api/validation";
import { CheckpointRequestSchema } from "@/lib/api/schemas";
import { assertHostForRun } from "@/lib/authz/host";
import type { CityState, PlayerStartupState } from "@/lib/types/city";

function mergePlayerStartups(
  candidateStartups: PlayerStartupState[],
  existingStartups: PlayerStartupState[],
) {
  const candidateById = new Map(candidateStartups.map((startup) => [startup.id, startup]));
  const merged = existingStartups.map((existingStartup) => {
    const candidateStartup = candidateById.get(existingStartup.id);
    if (!candidateStartup) {
      return existingStartup;
    }

    if (existingStartup.resolvedChoices.length > candidateStartup.resolvedChoices.length) {
      return existingStartup;
    }

    if (!candidateStartup.activeChoiceRound && existingStartup.activeChoiceRound) {
      return existingStartup;
    }

    if (
      candidateStartup.activeChoiceRound &&
      existingStartup.activeChoiceRound &&
      candidateStartup.activeChoiceRound.id !== existingStartup.activeChoiceRound.id
    ) {
      return existingStartup.resolvedChoices.length >= candidateStartup.resolvedChoices.length
        ? existingStartup
        : candidateStartup;
    }

    return candidateStartup;
  });

  const mergedIds = new Set(merged.map((startup) => startup.id));
  for (const startup of candidateStartups) {
    if (!mergedIds.has(startup.id)) {
      merged.push(startup);
    }
  }

  return merged;
}

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, CheckpointRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const hostAuth = await assertHostForRun(parsed.data.runId);
  if (!hostAuth.ok) {
    return hostAuth.response;
  }

  const { runId, state } = parsed.data;
  if (state.runId !== runId || state.roomId !== (await getRunByRunId(runId))?.roomId) {
    return NextResponse.json({ error: "Checkpoint payload mismatch" }, { status: 400 });
  }

  const run = await getRunByRunId(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const candidate = {
    ...(state as typeof run),
    playerStartups: mergePlayerStartups(state.playerStartups, run.playerStartups),
    ticker: Array.from(new Set([...(state.ticker ?? []), ...(run.ticker ?? [])])).slice(0, 8),
  };
  await setRunCheckpoint(candidate);

  return NextResponse.json({ ok: true, tick: (candidate as CityState).tick });
}
