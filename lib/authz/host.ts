import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/env";
import { getRoom, getRunByRunId } from "@/lib/data/store";
import { getStackUserId as getCurrentStackUserId } from "@/lib/stack/server";
import type { RoomRecord } from "@/lib/types/city";

type HostAuthResult =
  | {
      ok: true;
      room: RoomRecord;
      userId: string | null;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function assertHostForRoom(roomId: string): Promise<HostAuthResult> {
  const room = await getRoom(roomId);
  if (!room) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Room not found" }, { status: 404 }),
    };
  }

  if (isDemoMode()) {
    return { ok: true, room, userId: "demo-host" };
  }

  const userId = await getCurrentStackUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required to control this room" },
        { status: 401 },
      ),
    };
  }

  if (room.hostUserId !== userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only room host can perform this action" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, room, userId };
}

export async function assertHostForRun(runId: string): Promise<
  ({ ok: true; room: RoomRecord; userId: string | null; runId: string } | HostAuthResult)
> {
  const run = await getRunByRunId(runId);
  if (!run) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Run not found" }, { status: 404 }),
    };
  }

  const hostResult = await assertHostForRoom(run.roomId);
  if (!hostResult.ok) {
    return hostResult;
  }

  return { ...hostResult, runId: run.runId };
}
