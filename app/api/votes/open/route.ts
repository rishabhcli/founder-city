import { NextRequest, NextResponse } from "next/server";
import { getRunByRoomId, getRunByRunId, setVoteRound } from "@/lib/data/store";
import { createVoteRound } from "@/lib/sim/engine";
import { parseRequestBody } from "@/lib/api/validation";
import { VoteOpenRequestSchema } from "@/lib/api/schemas";
import { assertHostForRun } from "@/lib/authz/host";
import { isDemoMode } from "@/lib/env";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, VoteOpenRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const run = parsed.data.runId
    ? await getRunByRunId(parsed.data.runId)
    : parsed.data.roomId
      ? await getRunByRoomId(parsed.data.roomId)
      : undefined;

  if (!isDemoMode() && run?.runId) {
    const hostAuth = await assertHostForRun(run.runId);
    if (!hostAuth.ok) {
      return hostAuth.response;
    }
  }
  const activeRun = run;
  if (!activeRun) {
    return NextResponse.json({ error: "Run not active" }, { status: 404 });
  }

  if (activeRun.activeVoteRound) {
    return NextResponse.json({ run: activeRun });
  }

  const voteRound = createVoteRound(activeRun, activeRun.elapsedMs);
  const updated = await setVoteRound(voteRound, activeRun.runId);
  return NextResponse.json({ run: updated ?? activeRun });
}
