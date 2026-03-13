import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoomByInvite } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    inviteCode?: string;
    roomId?: string;
  };

  const { inviteCode, roomId } = body;
  const room = inviteCode
    ? await joinRoomByInvite(inviteCode)
    : roomId
      ? await getRoom(roomId)
      : null;

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}
