"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { CITY_TICK_MS, advanceCityState } from "@/lib/sim/engine";
import {
  AGENT_TICK_INTERVAL_MS,
  findShortestPath,
  VOTE_WINDOW_MS,
} from "@/lib/sim/graph";
import { clamp, formatRelativeMs } from "@/lib/utils";
import type {
  FounderDecision,
  ManagerDecision,
  PulseEventDecision,
  CityState,
  VoteRound,
  RoomStatus,
} from "@/lib/types/city";
import { CityBoard } from "@/components/city/CityBoard";
import { ScoreBar } from "@/components/city/ScoreBar";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type CitySimulationClientProps = {
  roomId: string;
  host: boolean;
  compact?: boolean;
};

const CHECKPOINT_INTERVAL_MS = 5_000;

function cloneCity<T>(state: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as T;
}

function selectVoterKey() {
  if (typeof window === "undefined") {
    return "server";
  }
  const existing = window.localStorage.getItem("founder-city-audience");
  if (existing) {
    return existing;
  }
  const next = Math.random().toString(36).slice(2, 10);
  window.localStorage.setItem("founder-city-audience", next);
  return next;
}

function applyManagerDecisionLocal(state: CityState, decision: ManagerDecision) {
  const district = state.districts[decision.targetDistrict];
  if (!district) {
    return;
  }

  const rawImpact = decision.impact ?? 8;
  const impact = clamp(Math.round(rawImpact), 0, 100);
  const department = decision.department;

  if (!department) {
    return;
  }

  if (department === "transit") {
    district.stats.congestion = clamp(district.stats.congestion - impact * 0.6, 0, 100);
    district.stats.talent = clamp(district.stats.talent + impact * 0.16, 0, 100);
  }

  if (department === "capital") {
    district.stats.capital = clamp(district.stats.capital + impact * 0.9, 0, 100);
    district.stats.compute = clamp(district.stats.compute + impact * 0.4, 0, 100);
    district.stats.rentPressure = clamp(district.stats.rentPressure + impact * 0.12, 0, 100);
  }

  if (department === "community") {
    district.stats.vibe = clamp(district.stats.vibe + impact * 0.85, 0, 100);
    district.stats.localBusiness = clamp(district.stats.localBusiness + impact * 0.7, 0, 100);
  }

  if (department === "permits") {
    district.stats.permits = clamp(district.stats.permits + impact, 0, 100);
  }
}

function applyFounderDecisionLocal(state: CityState, founderId: string, decision: FounderDecision) {
  const current = state.founders.find((entry) => entry.id === founderId);
  if (!current) {
    return;
  }

  if (decision.speechBubble) {
    current.speechBubble = decision.speechBubble;
  }

  if (decision.action === "reroute" || decision.action === "relocate") {
    const route = findShortestPath(current.currentDistrict, decision.targetDistrict);
    current.targetDistrict = decision.targetDistrict;
    current.route = route;
    current.routeIndex = 0;
    current.routeProgress = 0;
    current.status = "relocating";
    return;
  }

  if (decision.action === "pivot") {
    current.status = "pivoted";
    current.needs = Array.from(new Set([...current.needs, "vibe", "localBusiness"]));
    current.pivotTolerance = clamp(current.pivotTolerance - 0.06, 0, 1);
    return;
  }

  if (decision.action === "stall") {
    current.status = "stalled";
    return;
  }

  if (decision.action === "breakout") {
    current.status = "breakout";
    current.companyType = `${current.companyType} Breakout`;
    return;
  }
}

function formatScore(score: number) {
  return `${Math.round(score)}`;
}

export function CitySimulationClient({ roomId, host, compact = false }: CitySimulationClientProps) {
  const [city, setCity] = useState<CityState | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("lobby");
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [selectedFounder, setSelectedFounder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cityRef = useRef<CityState | null>(null);
  const roomAudienceRef = useRef(0);

  const voterKey = useMemo(() => selectVoterKey(), []);

  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  const selectedFounderState = city?.founders.find((founder) => founder.id === selectedFounder) ?? null;

  const persistState = useCallback(async (state: CityState) => {
    if (!state?.runId) {
      return;
    }

    await fetch("/api/runs/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: state.runId, action: "setState", state }),
    });
  }, []);

  const notifyAudienceCount = useCallback(
    async (runId: string, audienceCount: number) => {
      const count = Math.max(0, Math.floor(audienceCount));
      if (!count || !runId || roomAudienceRef.current === count) {
        return;
      }
      roomAudienceRef.current = count;

      await fetch(`/api/rooms/${roomId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setAudience",
          runId,
          audienceCount: count,
        }),
      });
    },
    [roomId],
  );

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomId}/state`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json().catch(() => null)) as {
      run?: CityState | null;
      room?: { status?: RoomStatus };
      error?: string;
    };

    return payload;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const payload = await refresh();
      setRoomLoaded(true);
      if (cancelled) {
        return;
      }

      if (!payload) {
        setMessage("Could not load room state.");
        return;
      }

        if (!payload.run) {
          setRoomStatus(payload.room?.status ?? "lobby");
          setMessage(payload.error ?? "No active run yet. Start a new run when ready.");
          setCity(null);
          return;
        }

      setCity(payload.run);
      setRoomStatus(payload.run.status === "ended" ? "ended" : payload.room?.status ?? "active");
      setMessage(null);
      if (payload.room?.status === "ended") {
        setMessage(payload.error ?? null);
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, compact ? 1_200 : 1_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [compact, roomId, refresh]);

  const startRun = useCallback(async () => {
    setMessage(null);
    const response = await fetch("/api/rooms/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    if (!response.ok) {
      setMessage("Could not start run");
      return;
    }
    const payload = (await response.json().catch(() => null)) as { run?: CityState };
    if (payload?.run) {
      setCity(payload.run);
      setRoomStatus(payload.run.status);
    }
  }, [roomId]);

  const canStartRun = roomStatus === "lobby" || roomStatus === "paused";

  const castVote = useCallback(
    async (voteRound: VoteRound, optionId: string) => {
      if (!city) {
        return;
      }
      const response = await fetch("/api/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: city.runId,
          roomId,
          optionId,
          voterKey,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { run?: CityState };
      if (payload?.run) {
        setCity(payload.run);
      }
    },
    [city, roomId, voterKey],
  );

  const resolveVoteFromHost = useCallback(async () => {
    if (!city?.activeVoteRound || !host) {
      return;
    }
    const elapsed = city.elapsedMs;
    if (elapsed < city.activeVoteRound.closesAt) {
      return;
    }
    const response = await fetch("/api/votes/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: city.runId }),
    });
    const payload = (await response.json().catch(() => null)) as { run?: CityState };
    if (payload?.run) {
      setCity(payload.run);
    }
  }, [city, host]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!city?.runId) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(`city:${roomId}`, { config: { presence: { key: voterKey } } });
    const flushAudience = (state?: unknown) => {
      const currentPresence =
        state ??
        (typeof channel.presenceState === "function"
          ? channel.presenceState()
          : null);
      const presence = (currentPresence ??
        {}) as Record<string, Array<{ role?: string }>>;
      let count = 0;
      for (const peers of Object.values(presence)) {
        if (Array.isArray(peers)) {
          count += peers.length;
        }
      }
      void notifyAudienceCount(city.runId, Math.max(count, 1));
    };

    channel
      .on("presence", { event: "sync" }, () => {
        flushAudience();
      })
      .on("presence", { event: "join" }, () => {
        flushAudience();
      })
      .on("presence", { event: "leave" }, () => {
        flushAudience();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            voterKey,
            role: host ? "host" : "audience",
            updatedAt: Date.now(),
          });
          flushAudience();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [city?.runId, host, notifyAudienceCount, roomId, voterKey]);

  useEffect(() => {
    if (!host) {
      return;
    }

    const tickInterval = setInterval(() => {
      setCity((current) => {
        if (!current || current.status !== "active") {
          return current;
        }

        const next = advanceCityState(current, clamp(current.elapsedMs + CITY_TICK_MS, 0, 150_000));
        const shouldCheckpoint =
          next.elapsedMs >= 150_000 ||
          Math.floor(next.elapsedMs / CHECKPOINT_INTERVAL_MS) > Math.floor(current.elapsedMs / CHECKPOINT_INTERVAL_MS);
        if (shouldCheckpoint) {
          void persistState(next);
        }

        if (next.status === "ended") {
          setMessage("Run ended. Open the report from the summary.");
        }

        if (next.activeVoteRound && next.elapsedMs >= next.activeVoteRound.closesAt) {
          void resolveVoteFromHost();
        }

        return next;
      });
    }, CITY_TICK_MS);

    const agentInterval = setInterval(() => {
      const latest = cityRef.current;
      if (!latest || latest.status !== "active") {
        return;
      }

      const targetFounder = latest.founders.find((founder) => founder.status !== "dead");
      const activeManager = latest.managers[latest.tick % latest.managers.length];

      const founderTask = targetFounder
        ? fetch("/api/agents/founder-tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              city: latest,
              founderId: targetFounder.id,
            }),
          })
            .then((response) => response.json())
            .then((payload) => payload as { decision?: FounderDecision })
            .catch(() => ({ decision: null }))
        : Promise.resolve({ decision: null } as { decision: FounderDecision | null });

      const managerTask = activeManager
        ? fetch("/api/agents/city-manager-tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              city: latest,
              managerId: activeManager.id,
            }),
          })
            .then((response) => response.json())
            .then((payload) => payload as { decision?: ManagerDecision })
            .catch(() => ({ decision: null }))
        : Promise.resolve({ decision: null } as { decision: ManagerDecision | null });

      const pulseTask = latest.tick > 60 && latest.tick % 4 === 0
        ? fetch("/api/agents/pulse-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ city: latest }),
          })
            .then((response) => response.json())
            .then((payload) => payload as { decision?: PulseEventDecision })
            .catch(() => ({ decision: null }))
        : Promise.resolve({ decision: null } as { decision: null });

      void Promise.all([founderTask, managerTask, pulseTask]).then(
        ([founderPayload, managerPayload, pulsePayload]) => {
          setCity((current) => {
            if (!current || current.status !== "active") {
              return current;
            }

            const next = cloneCity(current);
            if (founderPayload.decision && targetFounder) {
              applyFounderDecisionLocal(next, targetFounder.id, founderPayload.decision);
            }
            if (managerPayload.decision && activeManager) {
              applyManagerDecisionLocal(next, managerPayload.decision);
            }
            if (pulsePayload.decision?.effectVector && pulsePayload.decision?.headline) {
              next.ticker = [pulsePayload.decision.headline, ...next.ticker].slice(0, 6);
              for (const districtId of pulsePayload.decision.affectedDistricts ?? []) {
                const district = next.districts[districtId];
                if (!district) {
                  continue;
                }
                const effect = pulsePayload.decision.effectVector as Partial<{
                  capital: number;
                  talent: number;
                  compute: number;
                  permits: number;
                  vibe: number;
                  localBusiness: number;
                  congestion: number;
                  rentPressure: number;
                }>;
                for (const [key, value] of Object.entries(effect)) {
                  if (typeof value !== "number") {
                    continue;
                  }
                  district.stats[key as keyof typeof district.stats] = clamp(
                    district.stats[key as keyof typeof district.stats] + value,
                    0,
                    100,
                  );
                }
              }
            }
            return next;
          });
        },
      );
    }, AGENT_TICK_INTERVAL_MS);

      return () => {
        clearInterval(tickInterval);
        clearInterval(agentInterval);
      };
  }, [host, notifyAudienceCount, persistState, resolveVoteFromHost]);

  if (!city) {
    return (
      <div className="grid gap-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/65 p-4">
        <div className="rounded-xl bg-black/40 p-3">
          <h1 className="text-xl font-black text-cyan-200">Founder City Session</h1>
          <p className="mt-1 text-sm text-zinc-300">
            Room {roomId}
            <span className="ml-2 rounded-full border border-zinc-500 px-2 py-0.5 text-[10px] uppercase">
              {roomStatus}
            </span>
          </p>
          {message ? <p className="mt-2 rounded-md bg-zinc-900/70 p-2 text-sm text-zinc-200">{message}</p> : null}
        </div>

        {host && roomStatus === "lobby" ? (
          <button
            onClick={startRun}
            className="w-full rounded-md bg-fuchsia-500 px-3 py-2 font-semibold text-zinc-950 hover:bg-fuchsia-400"
          >
            Start Run
          </button>
        ) : null}

        {!roomLoaded ? <p className="text-zinc-300">Loading city state…</p> : null}
      </div>
    );
  }

  const voteProgressMs = city.activeVoteRound
    ? clamp(city.activeVoteRound.closesAt - city.elapsedMs, 0, VOTE_WINDOW_MS)
    : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/65 p-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CityBoard
          state={city}
          selectedFounderId={selectedFounder}
          onSelectFounder={setSelectedFounder}
          compact={compact}
        />
        <div className="grid gap-3">
          <div className="rounded-xl bg-black/40 p-3">
            <h1 className="text-xl font-black text-cyan-200 sm:text-2xl">{city.headline}</h1>
            <p className="mt-1 text-sm text-zinc-300">Remaining: {formatRelativeMs(city.remainingMs)}</p>
            <p className="text-xs text-zinc-400">
              Room {roomId} • Tick {city.tick} • Voters {city.audienceCount}
            </p>
          </div>

          {host && city.status !== "active" ? (
            <button
              onClick={startRun}
              disabled={!canStartRun}
              className="w-full rounded-md bg-fuchsia-500 px-3 py-2 font-semibold text-zinc-950 hover:bg-fuchsia-400 disabled:opacity-60"
            >
              Start Run
            </button>
          ) : null}

          {city.status === "ended" ? (
            <Link
              href={`/report/${city.runId}`}
              className="inline-flex justify-center rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
            >
              Open City Report
            </Link>
          ) : null}

          {selectedFounderState ? (
            <div className="rounded-xl bg-zinc-900/90 p-3 text-xs text-zinc-200">
              <p className="font-semibold">{selectedFounderState.name}</p>
              <p className="text-zinc-300">Pitch: {selectedFounderState.pitch}</p>
              <p className="mt-1">Company: {selectedFounderState.companyType}</p>
              <p>Status: {selectedFounderState.status}</p>
              <p className="mt-1 text-zinc-400">Thought: {selectedFounderState.speechBubble}</p>
            </div>
          ) : null}

          {city.activeVoteRound ? (
            <div className="rounded-xl bg-zinc-900/70 p-3">
              <p className="mb-1 text-sm font-semibold text-zinc-100">
                Audience Vote · {voteProgressMs !== null ? `${Math.ceil(voteProgressMs / 1000)}s` : "closed"}
              </p>
              <p className="mb-2 text-xs text-zinc-300">{city.activeVoteRound.prompt}</p>
              <div className="grid gap-2">
                {city.activeVoteRound.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => castVote(city.activeVoteRound!, option.id)}
                    className="rounded-md bg-zinc-100 px-2 py-1 text-left text-xs text-zinc-950 hover:bg-zinc-200"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-xl bg-black/40 p-3">
            <p className="text-sm font-semibold text-zinc-100">Ticker</p>
            <ul className="mt-2 max-h-28 list-disc space-y-1 overflow-auto pl-4 text-xs text-zinc-300">
              {city.ticker.map((messageItem) => (
                <li key={`${messageItem}`}>{messageItem}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 p-3">
          <h2 className="mb-2 font-semibold text-zinc-100">City Metrics</h2>
          <div className="grid gap-3">
            <ScoreBar label="Startup Survival" score={city.score.startupSurvival} />
            <ScoreBar label="Commute Health" score={city.score.commuteHealth} />
            <ScoreBar label="Local Business" score={city.score.localBusiness} />
            <ScoreBar label="Vibe Index" score={city.score.vibeIndex} />
            <ScoreBar label="Neighborhood Balance" score={city.score.neighborhoodBalance} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 p-3">
          <h2 className="mb-2 font-semibold text-zinc-100">Active Managers</h2>
          <div className="grid gap-2 text-xs">
            {city.managers.map((manager) => (
              <div key={manager.id} className="rounded-md bg-zinc-900/80 p-2 text-zinc-200">
                <p className="font-semibold text-zinc-100">{manager.name}</p>
                <p className="text-zinc-300">{manager.speechBubble}</p>
                <p className="text-zinc-400">
                  {manager.department} · focus on {city.districts[manager.targetDistrict].label}
                </p>
                <p className="text-zinc-500">Impact {formatScore(manager.impact ?? 0)}%</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message ? <p className="rounded-md bg-red-500/25 p-3 text-sm text-red-100">{message}</p> : null}
    </div>
  );
}
