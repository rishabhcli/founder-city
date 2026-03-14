import { NextRequest, NextResponse } from "next/server";

import { SubmitPlayerChoiceRequestSchema } from "@/lib/api/schemas";
import { parseRequestBody } from "@/lib/api/validation";
import { resolveViewerIdentity } from "@/lib/authz/viewer";
import { submitPlayerStartupChoiceForRoom } from "@/lib/data/player-startups";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, SubmitPlayerChoiceRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const identity = await resolveViewerIdentity(parsed.data.viewerKey);
  if (!identity) {
    return NextResponse.json(
      { error: "Authentication required to control this startup." },
      { status: 401 },
    );
  }

  try {
    const result = await submitPlayerStartupChoiceForRoom({
      roomId: parsed.data.roomId,
      ownerUserId: identity.userId,
      choiceRoundId: parsed.data.choiceRoundId,
      optionId: parsed.data.optionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit choice." },
      { status: 400 },
    );
  }
}
