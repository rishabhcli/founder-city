import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runFounderDecision } from "@/lib/agents/runner";
import { parseRequestBody } from "@/lib/api/validation";
import { AgentTickRequestSchema } from "@/lib/api/schemas";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, AgentTickRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (!parsed.data.founderId) {
    return NextResponse.json({ error: "Invalid founder context" }, { status: 400 });
  }

  const city = parsed.data.city as CityState;
  const decision = await runFounderDecision(city, parsed.data.founderId);

  return NextResponse.json({ decision });
}
