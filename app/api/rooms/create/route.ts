import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { getStackUser } from "@/lib/stack/server";
import { createRoom } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
  };

  let hostUserId = isDemoMode() ? `demo-${Date.now()}` : "stack-user";
  if (!isDemoMode()) {
    const user = (await getStackUser()) as { id?: string } | null;
    if (user?.id) {
      hostUserId = user.id;
    }
  }

  const room = await createRoom({ name: body.name, hostUserId });

  return NextResponse.json({
    room,
  });
}
