import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runPulseDecision } from "@/lib/agents/runner";
import { parseRequestBody } from "@/lib/api/validation";
import { PulseEventRequestSchema } from "@/lib/api/schemas";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, PulseEventRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }
  const city = parsed.data.city as CityState;

  if (!city) {
    return NextResponse.json({ error: "City state required" }, { status: 400 });
  }

  const decision = await runPulseDecision(city);

  return NextResponse.json({ decision });
}
