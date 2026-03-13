import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runManagerDecision } from "@/lib/agents/runner";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    city?: unknown;
    managerId?: string;
  };

  if (!body.city || !body.managerId) {
    return NextResponse.json({ error: "Invalid city manager context" }, { status: 400 });
  }

  const city = body.city as CityState;
  const decision = await runManagerDecision(city, body.managerId);

  return NextResponse.json({ decision });
}
