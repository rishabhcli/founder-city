import { NextRequest, NextResponse } from "next/server";
import {
  getRunByRoomId,
  getRoom,
  getRunByRunId,
  saveRunState,
  setAudienceCount,
} from "@/lib/data/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = await getRoom(roomId);
  const run = await getRunByRoomId(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room, run });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = await getRoom(roomId);
  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    state?: unknown;
    audienceCount?: number;
    action?: "setAudience";
  };

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (body.action === "setAudience") {
    if (typeof body.runId === "string" && typeof body.audienceCount === "number") {
      await setAudienceCount(body.runId, body.audienceCount);
    }
    const currentRun = await getRunByRoomId(roomId);
    return NextResponse.json({ ok: true, room, run: currentRun });
  }

  if (body.runId && body.state && typeof body.runId === "string") {
    const current = await getRunByRunId(body.runId);
    if (!current) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    await saveRunState(body.state as typeof current);
    return NextResponse.json({ ok: true, run: await getRunByRunId(body.runId) });
  }

  return NextResponse.json({ error: "Payload missing" }, { status: 400 });
}
