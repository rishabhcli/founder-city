import { NextRequest, NextResponse } from "next/server";
import { getRunByRunId, getRunRecordByRunId } from "@/lib/data/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = await getRunByRunId(runId);
  const record = await getRunRecordByRunId(runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run, record });
}
