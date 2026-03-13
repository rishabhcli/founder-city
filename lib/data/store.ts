import { nanoid } from "nanoid";

import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createInitialCityState } from "@/lib/sim/graph";
import type {
  CityState,
  RoomRecord,
  RunRecord,
  ScoreState,
  VoteRecord,
  VoteRound,
  RoomStatus,
  RunStatus,
} from "@/lib/types/city";

interface CheckpointRecord {
  runId: string;
  tick: number;
  state: CityState;
  createdAt: string;
}

interface DbError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

type UntypedBuilder = {
  insert: (values: never, options?: unknown) => Promise<{ error: DbError | null }>;
  update: (values: never, options?: unknown) => {
    eq: (column: string, value: unknown) => Promise<{ error: DbError | null }>;
  };
  upsert: (values: never, options?: unknown) => Promise<{ error: DbError | null }>;
  delete: () => {
    eq: (column: string, value: unknown) => {
      eq: (column: string, value: unknown) => Promise<{ error: DbError | null }>;
    };
    in: (column: string, values: unknown[]) => Promise<{ error: DbError | null }>;
  };
};

function asUntypedBuilder(builder: unknown): UntypedBuilder {
  return builder as UntypedBuilder;
}

interface SingleResult<T> {
  data: T | null;
  error: DbError | null;
}

interface ManyResult<T> {
  data: T[] | null;
  error: DbError | null;
}

interface GlobalStoreApi {
  createRoom(args: { name?: string; hostUserId: string }): Promise<RoomRecord>;
  getRoom(roomId: string): Promise<RoomRecord | null>;
  joinRoomByInvite(inviteCode: string): Promise<RoomRecord | null>;
  startRun(roomId: string): Promise<CityState | null>;
  getRunByRoomId(roomId: string): Promise<CityState | null>;
  getRunByRunId(runId: string): Promise<CityState | null>;
  getRunRecordByRunId(runId: string): Promise<RunRecord | null>;
  getRunState(roomId: string): Promise<{ room: RoomRecord | null; run: CityState | null }>;
  saveRunState(state: CityState): Promise<void>;
  setVoteRound(round: VoteRound, runId: string): Promise<CityState | null>;
  castVote(args: {
    runId: string;
    optionId: string;
    voterKey: string;
  }): Promise<CityState | null>;
  listVotes(runId: string): Promise<VoteRecord[]>;
  setAudienceCount(runId: string, audienceCount: number): Promise<void>;
  setRunCheckpoint(state: CityState): Promise<void>;
  getLatestCheckpoint(runId: string): Promise<CheckpointRecord | null>;
  listActiveRuns(): Promise<CityState[]>;
}

function cloneCity<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

const INVITE_PREFIX = "FC-";
const MAX_INVITE_SUFFIX_LENGTH = 4;

const memoryState: {
  rooms: Map<string, RoomRecord>;
  runs: Map<string, CityState>;
  activeRunByRoom: Map<string, string>;
  roomByInvite: Map<string, string>;
  runRecords: Map<string, RunRecord>;
  checkpoints: Map<string, CheckpointRecord[]>;
  runVotes: Map<string, Map<string, string>>;
} = {
  rooms: new Map(),
  runs: new Map(),
  activeRunByRoom: new Map(),
  roomByInvite: new Map(),
  runRecords: new Map(),
  checkpoints: new Map(),
  runVotes: new Map(),
};

function makeInviteCode() {
  return `${INVITE_PREFIX}${nanoid(MAX_INVITE_SUFFIX_LENGTH).toUpperCase()}`;
}

function normalizeRoomStatus(status: string): RoomStatus {
  if (status === "active" || status === "ended" || status === "paused") {
    return status;
  }
  return "lobby";
}

function normalizeRunStatus(status: string): RunStatus {
  if (status === "ended" || status === "paused") {
    return status;
  }
  return "active";
}

function mapRoomFromDb(row: {
  id: string;
  name: string;
  stack_team_id: string | null;
  host_user_id: string;
  invite_code: string;
  status: string;
  active_run_id: string | null;
  created_at: string;
}): RoomRecord {
  return {
    id: row.id,
    name: row.name,
    stackTeamId: row.stack_team_id,
    hostUserId: row.host_user_id,
    inviteCode: row.invite_code,
    status: normalizeRoomStatus(row.status),
    activeRunId: row.active_run_id,
    createdAt: row.created_at,
  };
}

function mapRunRecordFromDb(row: {
  id: string;
  room_id: string;
  seed: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  final_scores: Record<string, unknown> | null;
}): RunRecord {
  const finalScores = row.final_scores
    ? ((row.final_scores as unknown) as ScoreState)
    : null;
  return {
    id: row.id,
    roomId: row.room_id,
    seed: row.seed,
    status: normalizeRunStatus(row.status),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    finalScores,
  };
}

function cityFromRunRecord(row: {
  room_id: string;
  id: string;
  state: CityState;
}): CityState {
  return {
    ...row.state,
    roomId: row.room_id,
    runId: row.id,
  };
}

const memoryStore: GlobalStoreApi = {
  async createRoom({ name, hostUserId }) {
    const roomId = nanoid();
    let inviteCode = makeInviteCode();
    while (memoryState.roomByInvite.has(inviteCode)) {
      inviteCode = makeInviteCode();
    }

    const room: RoomRecord = {
      id: roomId,
      name: name?.trim() || `Founder City ${roomId.slice(-4)}`,
      stackTeamId: null,
      hostUserId,
      inviteCode,
      status: "lobby",
      activeRunId: null,
      createdAt: nowIso(),
    };

    memoryState.rooms.set(roomId, room);
    memoryState.roomByInvite.set(inviteCode, roomId);
    return cloneCity(room);
  },

  async getRoom(roomId) {
    const room = memoryState.rooms.get(roomId);
    return room ? cloneCity(room) : null;
  },

  async joinRoomByInvite(inviteCode) {
    const normalized = inviteCode.trim().toUpperCase();
    const roomId = memoryState.roomByInvite.get(normalized);
    if (!roomId) {
      return null;
    }
    return memoryStore.getRoom(roomId);
  },

  async startRun(roomId) {
    const room = await memoryStore.getRoom(roomId);
    if (!room) {
      return null;
    }

    const runId = nanoid();
    const seed = `${roomId}-${runId}`;
    const cityState = createInitialCityState(seed, roomId, runId);

    const runRecord: RunRecord = {
      id: runId,
      roomId,
      seed,
      status: "active",
      startedAt: nowIso(),
      endedAt: null,
      finalScores: null,
    };

    memoryState.runs.set(runId, cloneCity(cityState));
    memoryState.runRecords.set(runId, runRecord);
    memoryState.activeRunByRoom.set(roomId, runId);

    room.activeRunId = runId;
    room.status = "active";
    memoryState.rooms.set(room.id, cloneCity(room));

    return cloneCity(cityState);
  },

  async getRunByRoomId(roomId) {
    const runId = memoryState.activeRunByRoom.get(roomId);
    if (!runId) {
      return null;
    }
    return memoryStore.getRunByRunId(runId);
  },

  async getRunByRunId(runId) {
    const run = memoryState.runs.get(runId);
    return run ? cloneCity(run) : null;
  },

  async getRunRecordByRunId(runId) {
    const record = memoryState.runRecords.get(runId);
    return record ? cloneCity(record) : null;
  },

  async getRunState(roomId) {
    return {
      room: await memoryStore.getRoom(roomId),
      run: await memoryStore.getRunByRoomId(roomId),
    };
  },

  async saveRunState(state) {
    const runRecord = await memoryStore.getRunRecordByRunId(state.runId);
    if (!runRecord) {
      return;
    }

    memoryState.runs.set(state.runId, cloneCity(state));

    const nextRunRecord: RunRecord = {
      ...runRecord,
      status: state.status === "ended" ? "ended" : "active",
      finalScores: state.status === "ended" ? state.score : runRecord.finalScores,
      endedAt: state.status === "ended" ? nowIso() : runRecord.endedAt,
    };
    memoryState.runRecords.set(state.runId, nextRunRecord);

    if (state.status === "ended") {
      const room = memoryState.rooms.get(state.roomId);
      if (room) {
        room.status = "ended";
        room.activeRunId = state.runId;
        memoryState.rooms.set(room.id, cloneCity(room));
      }
    }
  },

  async setVoteRound(round, runId) {
    const run = await memoryStore.getRunByRunId(runId);
    if (!run) {
      return null;
    }

    run.activeVoteRound = round;
    run.nextVoteAt = Number.MAX_SAFE_INTEGER;

    const roundMap = new Map<string, string>();
    memoryState.runVotes.set(run.runId, roundMap);

    memoryState.runs.set(run.runId, run);
    return cloneCity(run);
  },

  async castVote({ runId, optionId, voterKey }) {
    const run = await memoryStore.getRunByRunId(runId);
    if (!run?.activeVoteRound) {
      return null;
    }

    const roundMap = memoryState.runVotes.get(run.runId) ?? new Map<string, string>();
    roundMap.set(voterKey, optionId);
    memoryState.runVotes.set(run.runId, roundMap);

    const tallies: Record<string, number> = {};
    for (const vote of roundMap.values()) {
      tallies[vote] = (tallies[vote] ?? 0) + 1;
    }
    run.activeVoteRound.tallies = tallies;
    memoryState.runs.set(run.runId, run);

    return cloneCity(run);
  },

  async listVotes(runId) {
    const run = await memoryStore.getRunByRunId(runId);
    if (!run?.activeVoteRound) {
      return [];
    }
    const { activeVoteRound } = run;

    const votes = memoryState.runVotes.get(run.runId) ?? new Map<string, string>();
    return [...votes.entries()].map(([voterKey, optionId]) => ({
      id: `${runId}-${activeVoteRound.id}-${voterKey.slice(-6)}`,
      voteRoundId: activeVoteRound.id,
      voterKey,
      optionId,
      createdAt: nowIso(),
    }));
  },

  async setAudienceCount(runId, audienceCount) {
    const run = await memoryStore.getRunByRunId(runId);
    if (!run) {
      return;
    }

    run.audienceCount = Math.max(0, audienceCount);
    memoryState.runs.set(run.runId, run);
  },

  async setRunCheckpoint(state) {
    const checkpoints = memoryState.checkpoints.get(state.runId) ?? [];
    checkpoints.push({
      runId: state.runId,
      tick: state.tick,
      state: cloneCity(state),
      createdAt: nowIso(),
    });

    if (checkpoints.length > 6) {
      checkpoints.shift();
    }

    memoryState.checkpoints.set(state.runId, checkpoints);
    await memoryStore.saveRunState(state);
  },

  async getLatestCheckpoint(runId) {
    const checkpoints = memoryState.checkpoints.get(runId) ?? [];
    const latest = checkpoints.at(-1);
    return latest ? cloneCity(latest) : null;
  },

  async listActiveRuns() {
    const runs = [...memoryState.runs.values()];
    return runs.filter((run) => run.status === "active").map((run) => cloneCity(run));
  },
};

const supabaseStore: GlobalStoreApi = {
  async createRoom({ name, hostUserId }) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.createRoom({ name, hostUserId });
    }

    let roomId = nanoid();
    let inviteCode = makeInviteCode();
    let attempts = 0;

    while (attempts < 8) {
      const { data, error } = (await supabase
        .from("rooms")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle()) as SingleResult<{ id: string }>;

      if (!data && !error) {
        break;
      }
      roomId = nanoid();
      inviteCode = makeInviteCode();
      attempts += 1;
    }

    const roomRow = {
      id: roomId,
      name: name?.trim() || `Founder City ${roomId.slice(-4)}`,
      stack_team_id: null,
      host_user_id: hostUserId,
      invite_code: inviteCode,
      status: "lobby",
      active_run_id: null,
      created_at: nowIso(),
    };

    const { error } = await asUntypedBuilder(supabase.from("rooms")).insert(roomRow as never);
    if (error) {
      return memoryStore.createRoom({ name, hostUserId });
    }

    return mapRoomFromDb(roomRow);
  },

  async getRoom(roomId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.getRoom(roomId);
    }

    const { data, error } = (await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle()) as SingleResult<{
      id: string;
      name: string;
      stack_team_id: string | null;
      host_user_id: string;
      invite_code: string;
      status: string;
      active_run_id: string | null;
      created_at: string;
    }>;

    if (!data || error) {
      return null;
    }

    return mapRoomFromDb(data as {
      id: string;
      name: string;
      stack_team_id: string | null;
      host_user_id: string;
      invite_code: string;
      status: string;
      active_run_id: string | null;
      created_at: string;
    });
  },

  async joinRoomByInvite(inviteCode) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.joinRoomByInvite(inviteCode);
    }

    const normalized = inviteCode.trim().toUpperCase();
    const { data, error } = (await supabase
      .from("rooms")
      .select("*")
      .eq("invite_code", normalized)
      .maybeSingle()) as SingleResult<{
      id: string;
      name: string;
      stack_team_id: string | null;
      host_user_id: string;
      invite_code: string;
      status: string;
      active_run_id: string | null;
      created_at: string;
    }>;

    if (!data || error) {
      return null;
    }

    return mapRoomFromDb(data as {
      id: string;
      name: string;
      stack_team_id: string | null;
      host_user_id: string;
      invite_code: string;
      status: string;
      active_run_id: string | null;
      created_at: string;
    });
  },

  async startRun(roomId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.startRun(roomId);
    }

    const { data: roomData, error: roomError } = (await supabase
      .from("rooms")
      .select("id,status,active_run_id")
      .eq("id", roomId)
      .maybeSingle()) as SingleResult<{ id: string; status: string; active_run_id: string | null }>;

    if (!roomData || roomError) {
      return null;
    }

    const existingRunId = roomData.active_run_id as string | null;
    const existingRunStatus = roomData.status as string;

    if (existingRunId && existingRunStatus !== "ended") {
      const existingRun = await supabaseStore.getRunByRunId(existingRunId);
      if (existingRun) {
        return existingRun;
      }
    }

    const runId = nanoid();
    const seed = `${roomId}-${runId}`;
    const cityState = createInitialCityState(seed, roomId, runId);

    const runRow = {
      id: runId,
      room_id: roomId,
      seed,
      status: "active",
      started_at: nowIso(),
      ended_at: null,
      final_scores: null,
      state: cityState,
    };

    const inserted = await asUntypedBuilder(supabase.from("runs")).insert(runRow as never);
    if (inserted.error) {
      return memoryStore.startRun(roomId);
    }

    await asUntypedBuilder(supabase.from("rooms")).update({
      active_run_id: runId,
      status: "active",
    } as never).eq("id", roomId);

    return cloneCity(cityState);
  },

  async getRunByRoomId(roomId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.getRunByRoomId(roomId);
    }

    const { data: roomData, error: roomError } = (await supabase
      .from("rooms")
      .select("active_run_id")
      .eq("id", roomId)
      .maybeSingle()) as SingleResult<{ active_run_id: string | null }>;

    if (roomError || !roomData?.active_run_id) {
      return null;
    }

    return supabaseStore.getRunByRunId(roomData.active_run_id);
  },

  async getRunByRunId(runId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.getRunByRunId(runId);
    }

    const { data, error } = (await supabase
      .from("runs")
      .select("room_id,id,seed,status,started_at,ended_at,final_scores,state")
      .eq("id", runId)
      .maybeSingle()) as SingleResult<{
      room_id: string;
      id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
      state: CityState;
    }>;

    if (!data || error) {
      return null;
    }

    return cityFromRunRecord(data as {
      room_id: string;
      id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
      state: CityState;
    });
  },

  async getRunRecordByRunId(runId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.getRunRecordByRunId(runId);
    }

    const { data, error } = (await supabase
      .from("runs")
      .select("id,room_id,seed,status,started_at,ended_at,final_scores")
      .eq("id", runId)
      .maybeSingle()) as SingleResult<{
      id: string;
      room_id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
    }>;

    if (!data || error) {
      return null;
    }

    return mapRunRecordFromDb(data as {
      id: string;
      room_id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
    });
  },

  async getRunState(roomId) {
    const room = await supabaseStore.getRoom(roomId);
    const run = await supabaseStore.getRunByRoomId(roomId);
    return { room, run };
  },

  async saveRunState(state) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      await memoryStore.saveRunState(state);
      return;
    }

    const run = await supabaseStore.getRunRecordByRunId(state.runId);
    if (!run) {
      return;
    }

    await asUntypedBuilder(supabase.from("runs"))
      .update({
        status: state.status === "ended" ? "ended" : "active",
        ended_at: state.status === "ended" ? nowIso() : run.endedAt,
        final_scores: state.status === "ended" ? state.score : run.finalScores,
        state,
      } as never)
      .eq("id", state.runId);

    if (state.status === "ended") {
      await asUntypedBuilder(supabase.from("rooms"))
        .update({ status: "ended" } as never)
        .eq("id", state.roomId);
    }
  },

  async setVoteRound(round, runId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.setVoteRound(round, runId);
    }

    const run = await supabaseStore.getRunByRunId(runId);
    if (!run) {
      return null;
    }

    run.activeVoteRound = round;
    run.nextVoteAt = Number.MAX_SAFE_INTEGER;

    await asUntypedBuilder(supabase.from("runs")).update({ state: run } as never).eq("id", runId);
    await asUntypedBuilder(supabase.from("run_votes")).delete().eq("run_id", runId).eq("round_id", round.id);

    return run;
  },

  async castVote({ runId, optionId, voterKey }) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.castVote({ runId, optionId, voterKey });
    }

    const run = await supabaseStore.getRunByRunId(runId);
    if (!run?.activeVoteRound) {
      return null;
    }

    const roundId = run.activeVoteRound.id;
    const payload = {
      run_id: runId,
      round_id: roundId,
      voter_key: voterKey,
      option_id: optionId,
      created_at: nowIso(),
    };

    const { error } = await asUntypedBuilder(supabase.from("run_votes")).upsert(
      payload as never,
      { onConflict: "run_id,round_id,voter_key" },
    );

    if (error) {
      return memoryStore.castVote({ runId, optionId, voterKey });
    }

    const { data: voteData, error: voteError } = (await supabase
      .from("run_votes")
      .select("voter_key, option_id")
      .eq("run_id", runId)
      .eq("round_id", roundId)) as ManyResult<{ option_id: string; voter_key: string }>;

    if (voteError) {
      return run;
    }

    const tallies: Record<string, number> = {};
    for (const vote of voteData as Array<{ option_id: string }>) {
      tallies[vote.option_id] = (tallies[vote.option_id] ?? 0) + 1;
    }

    run.activeVoteRound.tallies = tallies;
    await asUntypedBuilder(supabase.from("runs")).update({ state: run } as never).eq("id", runId);

    return run;
  },

  async listVotes(runId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.listVotes(runId);
    }

    const run = await supabaseStore.getRunByRunId(runId);
    if (!run?.activeVoteRound) {
      return [];
    }

    const roundId = run.activeVoteRound.id;
    const { data, error } = (await supabase
      .from("run_votes")
      .select("round_id,voter_key,option_id,created_at")
      .eq("run_id", runId)
      .eq("round_id", roundId)
      .order("created_at", { ascending: false })) as ManyResult<{
      round_id: string;
      voter_key: string;
      option_id: string;
      created_at: string;
    }>;

    if (error || !data) {
      return [];
    }

    return (data as Array<{ round_id: string; voter_key: string; option_id: string; created_at: string }>)
      .map((vote) => ({
        id: `${runId}-${vote.round_id}-${vote.voter_key.slice(-6)}`,
        voteRoundId: vote.round_id,
        voterKey: vote.voter_key,
        optionId: vote.option_id,
        createdAt: vote.created_at,
      }));
  },

  async setAudienceCount(runId, audienceCount) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      await memoryStore.setAudienceCount(runId, audienceCount);
      return;
    }

    const run = await supabaseStore.getRunByRunId(runId);
    if (!run) {
      return;
    }

    run.audienceCount = Math.max(0, audienceCount);
    await asUntypedBuilder(supabase.from("runs")).update({ state: run } as never).eq("id", runId);
  },

  async setRunCheckpoint(state) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      await memoryStore.setRunCheckpoint(state);
      return;
    }

    await asUntypedBuilder(supabase.from("run_checkpoints")).insert({
      run_id: state.runId,
      tick: state.tick,
      state,
    } as never);

    const stale = (await supabase
      .from("run_checkpoints")
      .select("id, created_at")
      .eq("run_id", state.runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .range(6, 10)) as ManyResult<{ id: string }>;

    if (stale.data && stale.data.length > 0) {
      await asUntypedBuilder(supabase.from("run_checkpoints")).delete().in(
        "id",
        stale.data.map((entry: { id: string }) => entry.id),
      );
    }

    await supabaseStore.saveRunState(state);
  },

  async getLatestCheckpoint(runId) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.getLatestCheckpoint(runId);
    }

    const { data, error } = (await supabase
      .from("run_checkpoints")
      .select("run_id,tick,state,created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SingleResult<{
      run_id: string;
      tick: number;
      state: CityState;
      created_at: string;
    }>;

    if (!data || error) {
      return null;
    }

    const row = data as {
      run_id: string;
      tick: number;
      state: CityState;
      created_at: string;
    };

    return {
      runId: row.run_id,
      tick: row.tick,
      state: row.state,
      createdAt: row.created_at,
    };
  },

  async listActiveRuns() {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return memoryStore.listActiveRuns();
    }

    const { data, error } = (await supabase
      .from("runs")
      .select("room_id,id,seed,status,started_at,ended_at,final_scores,state")
      .eq("status", "active")
      .limit(200)) as ManyResult<{
      room_id: string;
      id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
      state: CityState;
    }>;

    if (!data || error) {
      return [];
    }

    return (data as Array<{
      room_id: string;
      id: string;
      seed: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      final_scores: Record<string, unknown> | null;
      state: CityState;
    }>).map((row) =>
      cityFromRunRecord({
        room_id: row.room_id,
        id: row.id,
        state: row.state,
      }),
    );
  },
};

function getBackend(): GlobalStoreApi {
  if (isSupabaseConfigured()) {
    return supabaseStore;
  }
  return memoryStore;
}

export async function createRoom(args: { name?: string; hostUserId: string }): Promise<RoomRecord> {
  return getBackend().createRoom(args);
}

export async function getRoom(roomId: string): Promise<RoomRecord | null> {
  return getBackend().getRoom(roomId);
}

export async function joinRoomByInvite(inviteCode: string): Promise<RoomRecord | null> {
  return getBackend().joinRoomByInvite(inviteCode);
}

export async function startRun(roomId: string): Promise<CityState | null> {
  return getBackend().startRun(roomId);
}

export async function getRunByRoomId(roomId: string): Promise<CityState | null> {
  return getBackend().getRunByRoomId(roomId);
}

export async function getRunByRunId(runId: string): Promise<CityState | null> {
  return getBackend().getRunByRunId(runId);
}

export async function getRunRecordByRunId(runId: string): Promise<RunRecord | null> {
  return getBackend().getRunRecordByRunId(runId);
}

export async function getRunState(roomId: string) {
  return getBackend().getRunState(roomId);
}

export async function saveRunState(state: CityState): Promise<void> {
  await getBackend().saveRunState(state);
}

export async function setVoteRound(round: VoteRound, runId: string): Promise<CityState | null> {
  return getBackend().setVoteRound(round, runId);
}

export async function castVote(args: {
  runId: string;
  optionId: string;
  voterKey: string;
}): Promise<CityState | null> {
  return getBackend().castVote(args);
}

export async function listVotes(runId: string): Promise<VoteRecord[]> {
  return getBackend().listVotes(runId);
}

export async function setAudienceCount(runId: string, audienceCount: number): Promise<void> {
  await getBackend().setAudienceCount(runId, audienceCount);
}

export async function setRunCheckpoint(state: CityState): Promise<void> {
  await getBackend().setRunCheckpoint(state);
}

export async function getLatestCheckpoint(runId: string): Promise<CheckpointRecord | null> {
  return getBackend().getLatestCheckpoint(runId);
}

export async function listActiveRuns(): Promise<CityState[]> {
  return getBackend().listActiveRuns();
}

export { cloneCity as toDistrictSafeRecord };
