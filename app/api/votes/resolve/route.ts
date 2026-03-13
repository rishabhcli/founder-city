import { NextRequest, NextResponse } from "next/server";
import { getRunByRoomId, getRunByRunId } from "@/lib/data/store";
import { saveRunState } from "@/lib/data/store";
import { applyVoteResolution } from "@/lib/sim/engine";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    roomId?: string;
    optionId?: string;
  };

  const run = body.runId
    ? await getRunByRunId(body.runId)
    : body.roomId
      ? await getRunByRoomId(body.roomId)
      : null;
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (!run.activeVoteRound) {
    return NextResponse.json({ run, error: "No active vote" });
  }

  const resolved = applyVoteResolution(run, run.activeVoteRound, body.optionId ?? null);
  saveRunState(resolved);
  return NextResponse.json({ run: resolved });
}
