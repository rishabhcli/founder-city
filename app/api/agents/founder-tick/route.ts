import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runFounderDecision } from "@/lib/agents/runner";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    city?: unknown;
    founderId?: string;
  };

  if (!body.city || !body.founderId) {
    return NextResponse.json({ error: "Invalid founder context" }, { status: 400 });
  }

  const city = body.city as CityState;
  const decision = await runFounderDecision(city, body.founderId);

  return NextResponse.json({ decision });
}
