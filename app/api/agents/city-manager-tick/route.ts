import { NextRequest, NextResponse } from "next/server";
import type { CityState } from "@/lib/types/city";
import { runManagerDecision } from "@/lib/agents/runner";
import { parseRequestBody } from "@/lib/api/validation";
import { CityManagerTickRequestSchema } from "@/lib/api/schemas";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, CityManagerTickRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (!parsed.data.managerId) {
    return NextResponse.json({ error: "Invalid city manager context" }, { status: 400 });
  }

  const city = parsed.data.city as CityState;
  const decision = await runManagerDecision(city, parsed.data.managerId);

  return NextResponse.json({ decision });
}
