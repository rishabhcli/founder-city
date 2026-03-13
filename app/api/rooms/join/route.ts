import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoomByInvite } from "@/lib/data/store";
import { parseRequestBody } from "@/lib/api/validation";
import { JoinRoomRequestSchema } from "@/lib/api/schemas";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, JoinRoomRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { inviteCode, roomId } = parsed.data;
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
