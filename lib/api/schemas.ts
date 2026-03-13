import { z } from "zod";
import type { CityState } from "@/lib/types/city";

const RunIdOrRoomId = z
  .object({
    runId: z.string().trim().min(1).optional(),
    roomId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.runId || value.roomId), {
    message: "Either runId or roomId is required.",
    path: ["runId"],
  });

const OneToTenCharName = z
  .string()
  .trim()
  .max(64)
  .transform((value) => value.slice(0, 64));

const CityStateLikeSchema = z
  .custom<CityState>(() => true, { message: "Invalid city state shape" })
  .transform((value) => value as CityState);

export const CreateRoomRequestSchema = z.object({
  name: OneToTenCharName.optional(),
});

export const JoinRoomRequestSchema = z
  .object({
    inviteCode: z.string().trim().min(4).max(20).toUpperCase().optional(),
    roomId: z.string().trim().min(8).max(64).optional(),
  })
  .refine((value) => Boolean(value.inviteCode || value.roomId), {
    message: "Either inviteCode or roomId is required.",
    path: ["inviteCode"],
  });

export const StartRunRequestSchema = z.object({
  roomId: z.string().trim().min(8).max(64),
});

const CityStateSchema = z
  .custom<CityState>(() => true, { message: "Invalid city state payload" })
  .transform((value) => value as CityState);

export const CheckpointRequestSchema = z.object({
  runId: z.string().trim().min(8).max(64),
  state: CityStateSchema,
});

export const SetAudienceStateSchema = z.object({
  action: z.literal("setAudience"),
  runId: z.string().trim().min(8).max(64),
  audienceCount: z.number().nonnegative().max(2000).int(),
});

export const SetRunStatePayloadSchema = z.object({
  action: z.literal("setState"),
  state: CityStateSchema,
});

export const RoomStatePostSchema = z.discriminatedUnion("action", [
  SetAudienceStateSchema,
  SetRunStatePayloadSchema,
]);

export const VoteOpenRequestSchema = RunIdOrRoomId;

export const VoteResolveRequestSchema = RunIdOrRoomId.extend({
  optionId: z.string().trim().min(1).max(64).optional(),
});

export const VoteCastSchema = z
  .object({
    optionId: z.string().trim().min(1).max(64),
    voterKey: z.string().trim().min(4).max(64),
  })
  .and(RunIdOrRoomId);

export const AgentTickRequestSchema = z.object({
  city: CityStateLikeSchema,
  founderId: z.string().trim().min(4).max(64).optional(),
});

export const CityManagerTickRequestSchema = z.object({
  city: CityStateLikeSchema,
  managerId: z.string().trim().min(4).max(64).optional(),
});

export const PulseEventRequestSchema = z.object({
  city: CityStateLikeSchema,
});

export type CityStateEnvelope = CityState;
