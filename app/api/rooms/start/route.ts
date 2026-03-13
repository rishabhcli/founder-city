import { NextRequest, NextResponse } from "next/server";
import { getRoom, startRun } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { roomId?: string };
  if (!body.roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  const room = await getRoom(body.roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const run = await startRun(room.id);
  if (!run) {
    return NextResponse.json({ error: "Could not start run" }, { status: 500 });
  }

  return NextResponse.json({ run });
}
