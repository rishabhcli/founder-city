import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { env } from "@/lib/env";
import type { DistrictId, PlayerStartupTheme } from "@/lib/types/city";

const NameSuggestionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9 '&.-]+$/, "Use a short startup-style name."),
});

const THEME_COLORS: Record<PlayerStartupTheme, string> = {
  "ai-infra": "#4de2ff",
  robotics: "#ff9f1c",
  biotech: "#7ae582",
  consumer: "#ff6f61",
  fintech: "#ffd166",
  commerce: "#d4a5ff",
  design: "#f7c96a",
  climate: "#7dd3fc",
};

const DISTRICT_THEME_HINTS: Record<DistrictId, PlayerStartupTheme> = {
  soma: "ai-infra",
  fidi: "fintech",
  mission: "consumer",
  hayes: "design",
  dogpatch: "robotics",
  "mission-bay": "biotech",
  "north-beach": "commerce",
  "sunset-richmond": "climate",
};

let cachedOpenAi: OpenAI | null = null;
let cachedGemini: GoogleGenAI | null = null;

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY ?? env.openAiApiKey;
  if (!apiKey) {
    return null;
  }

  if (!cachedOpenAi) {
    cachedOpenAi = new OpenAI({ apiKey });
  }

  return cachedOpenAi;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? env.geminiApiKey;
  if (!apiKey) {
    return null;
  }

  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({ apiKey });
  }

  return cachedGemini;
}

function pickThemeFromDescription(description: string, districtId: DistrictId): PlayerStartupTheme {
  const normalized = description.toLowerCase();

  if (/(robot|hardware|warehouse|drone|factory|autonom|sensor)/.test(normalized)) {
    return "robotics";
  }
  if (/(bio|health|clinic|drug|lab|medical|therap)/.test(normalized)) {
    return "biotech";
  }
  if (/(bank|finance|treasury|payments|risk|invoice|compliance)/.test(normalized)) {
    return "fintech";
  }
  if (/(design|brand|retail|studio|shop|creator)/.test(normalized)) {
    return "design";
  }
  if (/(climate|solar|grid|energy|sustain|carbon|water)/.test(normalized)) {
    return "climate";
  }
  if (/(consumer|community|social|event|dining|marketplace|neighborhood)/.test(normalized)) {
    return "consumer";
  }
  if (/(sales|merchant|commerce|checkout|restaurant|storefront)/.test(normalized)) {
    return "commerce";
  }
  if (/(agent|infra|compute|model|data|api|developer|tooling|cloud)/.test(normalized)) {
    return "ai-infra";
  }

  return DISTRICT_THEME_HINTS[districtId];
}

function fallbackName(description: string, districtId: DistrictId) {
  const words = description
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  const districtStem = {
    soma: "Stack",
    fidi: "Ledger",
    mission: "Signal",
    hayes: "Studio",
    dogpatch: "Forge",
    "mission-bay": "Cortex",
    "north-beach": "Harbor",
    "sunset-richmond": "Tide",
  } satisfies Record<DistrictId, string>;

  const first = words[0]?.slice(0, 1).toUpperCase() + words[0]?.slice(1).toLowerCase();
  const second = words[1]?.slice(0, 1).toUpperCase() + words[1]?.slice(1).toLowerCase();

  if (first && second) {
    return `${first} ${second}`.slice(0, 32);
  }

  if (first) {
    return `${first} ${districtStem[districtId]}`.slice(0, 32);
  }

  return `${districtStem[districtId]} Labs`;
}

export function inferBrandTheme(description: string, districtId: DistrictId) {
  return pickThemeFromDescription(description, districtId);
}

export function brandColorForTheme(theme: PlayerStartupTheme) {
  return THEME_COLORS[theme];
}

export function startupMonogram(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "FC";
}

export function createFallbackLogoDataUrl(name: string, color: string) {
  const monogram = startupMonogram(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="44" fill="#020617" />
      <rect x="18" y="18" width="124" height="124" rx="34" fill="url(#g)" opacity="0.96" />
      <circle cx="124" cy="40" r="8" fill="rgba(255,255,255,0.72)" />
      <text x="80" y="96" text-anchor="middle" font-family="system-ui, sans-serif" font-size="54" font-weight="800" fill="#f8fafc">${monogram}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function generateStartupName(args: {
  description: string;
  districtId: DistrictId;
}) {
  const client = getOpenAiClient();
  if (!client) {
    return fallbackName(args.description, args.districtId);
  }

  try {
    const response = await client.responses.parse(
      {
        model: process.env.OPENAI_MODEL ?? env.openAiModel,
        instructions:
          "You generate concise startup names. Return exactly one short memorable Bay Area startup name. No punctuation-heavy gimmicks, no explanations.",
        input: `District: ${args.districtId}\nDescription: ${args.description}`,
        text: {
          format: zodTextFormat(NameSuggestionSchema, "startup_name"),
        },
      },
      {
        signal: AbortSignal.timeout(2_500),
      },
    );

    const parsed = response.output_parsed;
    if (parsed?.name) {
      return parsed.name;
    }
  } catch {
    // Fall through to deterministic naming.
  }

  return fallbackName(args.description, args.districtId);
}

export async function generateStartupLogo(args: {
  name: string;
  description: string;
  districtId: DistrictId;
  theme: PlayerStartupTheme;
  brandColor: string;
}) {
  const client = getGeminiClient();
  const fallback = createFallbackLogoDataUrl(args.name, args.brandColor);

  if (!client) {
    return fallback;
  }

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: `Create a square startup logo mark for "${args.name}".
Description: ${args.description}
Theme: ${args.theme}
District: ${args.districtId}
Style: geometric, bold, neon-accented, San Francisco startup ecosystem, dark-background friendly.
Requirements: icon only, no text, no letters, centered mark, polished app-logo aesthetic.`,
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType ?? "image/png";
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch {
    // Fall through to the procedural badge.
  }

  return fallback;
}
