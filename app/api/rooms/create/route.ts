import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { parseRequestBody } from "@/lib/api/validation";
import { CreateRoomRequestSchema } from "@/lib/api/schemas";
import { getStackUser } from "@/lib/stack/server";
import { createRoom } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, CreateRoomRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { name } = parsed.data;

  if (!isDemoMode()) {
    const user = await getStackUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
  }

  let hostUserId = isDemoMode() ? `demo-${Date.now()}` : undefined;
  if (!isDemoMode()) {
    const user = (await getStackUser()) as { id?: string } | null;
    if (user?.id) {
      hostUserId = user.id;
    } else {
      return NextResponse.json({ error: "Could not resolve host identity" }, { status: 400 });
    }
  }

  if (!hostUserId) {
    return NextResponse.json(
      { error: "Could not resolve host identity" },
      { status: 400 },
    );
  }

  const room = await createRoom({ name, hostUserId });

  return NextResponse.json({
    room,
  });
}
