import { getRunByRoomId, saveRunState } from "@/lib/data/store";
import { createPlayerStartup, resolvePlayerChoiceNow } from "@/lib/sim/player-startups";
import type { DistrictId, PlayerStartupState } from "@/lib/types/city";

export async function listPlayerStartupsByRoom(roomId: string) {
  const run = await getRunByRoomId(roomId);
  return run?.playerStartups ?? [];
}

export async function createPlayerStartupForRoom(args: {
  roomId: string;
  ownerUserId: string;
  ownerLabel: string;
  name: string;
  description: string;
  districtId: DistrictId;
  logoDataUrl?: string | null;
}) {
  const run = await getRunByRoomId(args.roomId);
  if (!run) {
    throw new Error("No active run found for this room.");
  }

  const existing = run.playerStartups.find(
    (startup) => startup.ownerUserId === args.ownerUserId,
  );
  if (existing) {
    return { run, startup: existing };
  }

  const startup = createPlayerStartup({
    city: run,
    ownerUserId: args.ownerUserId,
    ownerLabel: args.ownerLabel,
    name: args.name,
    description: args.description,
    districtId: args.districtId,
    logoDataUrl: args.logoDataUrl,
  });

  run.playerStartups = [...run.playerStartups, startup];
  run.ticker = [
    `${startup.name} just appeared in ${run.districts[startup.districtId].label}.`,
    ...run.ticker,
  ].slice(0, 6);
  run.headline = `${startup.name} joined the city.`;

  await saveRunState(run);
  return { run, startup };
}

export async function submitPlayerStartupChoiceForRoom(args: {
  roomId: string;
    ownerUserId: string;
  choiceRoundId: string;
  optionId: string;
}) {
  const run = await getRunByRoomId(args.roomId);
  if (!run) {
    throw new Error("No active run found for this room.");
  }

  const startup = run.playerStartups.find(
    (entry) => entry.ownerUserId === args.ownerUserId,
  );
  if (!startup) {
    throw new Error("Startup not found for this player.");
  }

  const selected = startup.activeChoiceRound?.options.find((option) => option.id === args.optionId);

  if (selected) {
    resolvePlayerChoiceNow(startup, run, args.choiceRoundId, args.optionId);
    run.ticker = [`${startup.name} chose: ${selected.label}.`, ...run.ticker].slice(0, 6);
    run.headline = `${startup.name} is moving in ${run.districts[startup.districtId].label}.`;
  }

  await saveRunState(run);
  return { run, startup };
}

export function findStartupByOwner(
  startups: PlayerStartupState[],
  ownerUserId: string,
) {
  return startups.find((startup) => startup.ownerUserId === ownerUserId) ?? null;
}
