import { NextResponse } from "next/server";

import { listPlayerStartupsByRoom } from "@/lib/data/player-startups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const startups = await listPlayerStartupsByRoom(roomId);

  return NextResponse.json({ startups });
}
