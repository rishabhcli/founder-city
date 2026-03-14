import { NextRequest, NextResponse } from "next/server";

import { parseRequestBody } from "@/lib/api/validation";
import { CreatePlayerStartupRequestSchema } from "@/lib/api/schemas";
import {
  brandColorForTheme,
  generateStartupLogo,
  inferBrandTheme,
} from "@/lib/ai/startup-branding";
import { resolveViewerIdentity } from "@/lib/authz/viewer";
import { createPlayerStartupForRoom } from "@/lib/data/player-startups";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, CreatePlayerStartupRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const identity = await resolveViewerIdentity(parsed.data.viewerKey);
  if (!identity) {
    return NextResponse.json(
      { error: "Authentication required to create a startup." },
      { status: 401 },
    );
  }

  try {
    const theme = inferBrandTheme(parsed.data.description, parsed.data.districtId);
    const logoDataUrl = await generateStartupLogo({
      name: parsed.data.name,
      description: parsed.data.description,
      districtId: parsed.data.districtId,
      theme,
      brandColor: brandColorForTheme(theme),
    });

    const result = await createPlayerStartupForRoom({
      roomId: parsed.data.roomId,
      ownerUserId: identity.userId,
      ownerLabel: identity.label,
      name: parsed.data.name,
      description: parsed.data.description,
      districtId: parsed.data.districtId,
      logoDataUrl,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create startup." },
      { status: 400 },
    );
  }
}
