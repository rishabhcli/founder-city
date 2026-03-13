import { NextRequest, NextResponse } from "next/server";
import { getRunByRoomId, getRunByRunId, setVoteRound } from "@/lib/data/store";
import { createVoteRound } from "@/lib/sim/engine";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    roomId?: string;
    runId?: string;
  };

  const run = body.runId
    ? await getRunByRunId(body.runId)
    : body.roomId
      ? await getRunByRoomId(body.roomId)
      : undefined;
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
