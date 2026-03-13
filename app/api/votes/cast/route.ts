import { NextRequest, NextResponse } from "next/server";
import { castVote, getRunByRoomId, saveRunState } from "@/lib/data/store";
import { applyVoteResolution } from "@/lib/sim/engine";

async function findRunId(body: { runId?: string; roomId?: string }) {
  if (body.runId) {
    return body.runId;
  }
  const roomId = body.roomId;
  if (!roomId) {
    return null;
  }
  const run = await getRunByRoomId(roomId);
  return run?.runId ?? null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    roomId?: string;
    optionId?: string;
    voterKey?: string;
  };

  if (!body.optionId || !body.voterKey) {
    return NextResponse.json({ error: "optionId and voterKey required" }, { status: 400 });
  }

  const runId = await findRunId(body);
  if (!runId) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const run = await castVote({ runId, optionId: body.optionId, voterKey: body.voterKey });
  if (!run) {
    return NextResponse.json({ error: "No active vote round" }, { status: 400 });
  }

  if (run.activeVoteRound && run.activeVoteRound.closesAt <= run.elapsedMs) {
    const resolved = applyVoteResolution(run, run.activeVoteRound);
    await saveRunState(resolved);
    return NextResponse.json({ run: resolved, runId });
  }

  await saveRunState(run);

  return NextResponse.json({ run });
}
