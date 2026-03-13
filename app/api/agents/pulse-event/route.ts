import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runPulseDecision } from "@/lib/agents/runner";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    city?: unknown;
    citySummary?: string;
    runPressure?: number;
    elapsedMs?: number;
  };

  if (!body.city) {
    return NextResponse.json({ error: "City state required" }, { status: 400 });
  }

  const city = body.city as CityState;
  const decision = await runPulseDecision(city);

  return NextResponse.json({ decision });
}
