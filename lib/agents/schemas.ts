import { z } from "zod";

import {
  DEPARTMENT_IDS,
  DISTRICT_IDS,
  FOUNDER_STATUSES,
  RESOURCE_KEYS,
} from "@/lib/types/city";

export const FounderDecisionSchema = z.object({
  action: z.enum(["reroute", "pivot", "stall", "relocate", "breakout"]),
  targetDistrict: z.enum(DISTRICT_IDS),
  priority: z.number().min(0).max(100),
  speechBubble: z.string().min(1).max(160),
  reason: z.string().min(1).max(280),
});

export const ManagerDecisionSchema = z.object({
  department: z.enum(DEPARTMENT_IDS),
  recommendationType: z.enum([
    "watchlist",
    "reroute",
    "grant",
    "festival",
    "fast-track",
  ]),
  targetDistrict: z.enum(DISTRICT_IDS),
  impact: z.number().min(0).max(100),
  speechBubble: z.string().min(1).max(160),
  reason: z.string().min(1).max(280),
});

export const PulseDecisionSchema = z.object({
  headline: z.string().min(1).max(180),
  eventType: z.enum([
    "permit-freeze",
    "muni-disruption",
    "founder-dinner",
    "demo-week",
    "cloud-credit-frenzy",
    "rent-shock",
  ]),
  affectedDistricts: z.array(z.enum(DISTRICT_IDS)).min(1).max(3),
  effectVector: z
    .object({
      capital: z.number().optional(),
      talent: z.number().optional(),
      compute: z.number().optional(),
      permits: z.number().optional(),
      vibe: z.number().optional(),
      localBusiness: z.number().optional(),
      congestion: z.number().optional(),
      rentPressure: z.number().optional(),
    })
    .refine(
      (value) => Object.keys(value).length > 0,
      "Pulse events must carry at least one effect.",
    ),
  tickerCopy: z.string().min(1).max(180),
});

export const FounderStateSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyType: z.string(),
  currentDistrict: z.enum(DISTRICT_IDS),
  targetDistrict: z.enum(DISTRICT_IDS),
  status: z.enum(FOUNDER_STATUSES),
  pitch: z.string(),
  burnRate: z.number(),
  runway: z.number(),
  pivotTolerance: z.number(),
});

export const DistrictSnapshotSchema = z.object({
  id: z.enum(DISTRICT_IDS),
  label: z.string(),
  stats: z.object(
    Object.fromEntries(
      RESOURCE_KEYS.map((resource) => [resource, z.number()]),
    ) as Record<(typeof RESOURCE_KEYS)[number], z.ZodNumber>,
  ),
});

export type FounderDecisionOutput = z.infer<typeof FounderDecisionSchema>;
export type ManagerDecisionOutput = z.infer<typeof ManagerDecisionSchema>;
export type PulseDecisionOutput = z.infer<typeof PulseDecisionSchema>;
