import { NextRequest, NextResponse } from "next/server";

import {
  brandColorForTheme,
  createFallbackLogoDataUrl,
  generateStartupName,
  inferBrandTheme,
  startupMonogram,
} from "@/lib/ai/startup-branding";
import { GenerateStartupNameRequestSchema } from "@/lib/api/schemas";
import { parseRequestBody } from "@/lib/api/validation";

export async function POST(request: NextRequest) {
  const parsed = await parseRequestBody(request, GenerateStartupNameRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const theme = inferBrandTheme(parsed.data.description, parsed.data.districtId);
    const name = await generateStartupName({
      description: parsed.data.description,
      districtId: parsed.data.districtId,
    });
    const brandColor = brandColorForTheme(theme);

    return NextResponse.json({
      name,
      theme,
      brandColor,
      logoMonogram: startupMonogram(name),
      previewLogoDataUrl: createFallbackLogoDataUrl(name, brandColor),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate startup name." },
      { status: 400 },
    );
  }
}
