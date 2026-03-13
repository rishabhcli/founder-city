import { NextRequest, NextResponse } from "next/server";
import { getRunByRunId, setRunCheckpoint } from "@/lib/data/store";
import { parseRequestBody } from "@/lib/api/validation";
import { CheckpointRequestSchema } from "@/lib/api/schemas";
import { assertHostForRun } from "@/lib/authz/host";
import type { CityState } from "@/lib/types/city";

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

  const candidate = state as typeof run;
  await setRunCheckpoint(candidate);

  return NextResponse.json({ ok: true, tick: (candidate as CityState).tick });
}
