import { NextRequest, NextResponse } from "next/server";
import {
  getRunByRoomId,
  getRoom,
  getRunByRunId,
  saveRunState,
  setAudienceCount,
} from "@/lib/data/store";
import { parseRequestBody } from "@/lib/api/validation";
import {
  RoomStatePostSchema,
} from "@/lib/api/schemas";
import { assertHostForRoom } from "@/lib/authz/host";
import { isDemoMode } from "@/lib/env";

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
  const parsed = await parseRequestBody(request, RoomStatePostSchema);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.data;

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (body.action === "setAudience") {
    await setAudienceCount(body.runId, body.audienceCount);
    const currentRun = await getRunByRoomId(roomId);
    return NextResponse.json({ ok: true, room, run: currentRun });
  }

  if (!isDemoMode()) {
    const hostAuth = await assertHostForRoom(roomId);
    if (!hostAuth.ok) {
      return hostAuth.response;
    }
  }

  if (body.action === "setState") {
    const current = await getRunByRunId(body.state.runId);
    if (!current) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (current.roomId !== roomId) {
      return NextResponse.json({ error: "Run does not belong to room" }, { status: 400 });
    }

    await saveRunState(body.state as typeof current);
    return NextResponse.json({ ok: true, run: await getRunByRunId(body.state.runId) });
  }

  return NextResponse.json({ error: "Payload missing" }, { status: 400 });
}
