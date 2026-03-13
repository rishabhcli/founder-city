import { NextRequest, NextResponse } from "next/server";
import { getRunByRoomId, getRunByRunId } from "@/lib/data/store";
import { saveRunState } from "@/lib/data/store";
import { applyVoteResolution } from "@/lib/sim/engine";
import { parseRequestBody } from "@/lib/api/validation";
import { VoteResolveRequestSchema } from "@/lib/api/schemas";
import { assertHostForRun } from "@/lib/authz/host";
import { isDemoMode } from "@/lib/env";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, VoteResolveRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const run = parsed.data.runId
    ? await getRunByRunId(parsed.data.runId)
    : parsed.data.roomId
      ? await getRunByRoomId(parsed.data.roomId)
      : null;
  if (!isDemoMode()) {
    if (!run?.runId) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const hostAuth = await assertHostForRun(run.runId);
    if (!hostAuth.ok) {
      return hostAuth.response;
    }
  }

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (!run.activeVoteRound) {
    return NextResponse.json({ run, error: "No active vote" });
  }

  const resolved = applyVoteResolution(run, run.activeVoteRound, parsed.data.optionId ?? null);
  saveRunState(resolved);
  return NextResponse.json({ run: resolved });
}
