import { NextRequest, NextResponse } from "next/server";
import { getRoom, startRun } from "@/lib/data/store";
import { parseRequestBody } from "@/lib/api/validation";
import { StartRunRequestSchema } from "@/lib/api/schemas";
import { isDemoMode } from "@/lib/env";
import { assertHostForRoom } from "@/lib/authz/host";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, StartRunRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { roomId } = parsed.data;
  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!isDemoMode()) {
    const hostAuth = await assertHostForRoom(room.id);
    if (!hostAuth.ok) {
      return hostAuth.response;
    }
  }

  const run = await startRun(room.id);
  if (!run) {
    return NextResponse.json({ error: "Could not start run" }, { status: 500 });
  }

  return NextResponse.json({ run });
}
