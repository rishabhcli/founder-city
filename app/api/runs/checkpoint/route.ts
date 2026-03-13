import { NextRequest, NextResponse } from "next/server";
import { getRunByRunId, setRunCheckpoint } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    state?: unknown;
  };

  if (!body.runId || !body.state) {
    return NextResponse.json({ error: "runId and state required" }, { status: 400 });
  }

  const run = await getRunByRunId(body.runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const candidate = body.state as typeof run;
  candidate.runId = run.runId;
  candidate.roomId = run.roomId;
  await setRunCheckpoint(candidate);

  return NextResponse.json({ ok: true, tick: candidate.tick });
}
