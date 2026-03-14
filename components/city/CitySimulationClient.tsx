"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { CityMapScene } from "@/components/city/CityMapScene";
import { ScoreBar } from "@/components/city/ScoreBar";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CITY_TICK_MS, advanceCityState } from "@/lib/sim/engine";
import { AGENT_TICK_INTERVAL_MS, VOTE_WINDOW_MS, findShortestPath } from "@/lib/sim/graph";
import type {
  CityState,
  FounderDecision,
  ManagerDecision,
  PulseEventDecision,
  RoomStatus,
  VoteRound,
} from "@/lib/types/city";
import { clamp, formatRelativeMs } from "@/lib/utils";

type CitySimulationClientProps = {
  roomId: string;
  host: boolean;
  compact?: boolean;
};

const CHECKPOINT_INTERVAL_MS = 1_000;

function cloneCity<T>(state: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as T;
}

function selectAudienceKey() {
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

  const impact = clamp(Math.round(decision.impact ?? 8), 0, 100);

  if (decision.department === "transit") {
    district.stats.congestion = clamp(district.stats.congestion - impact * 0.6, 0, 100);
    district.stats.talent = clamp(district.stats.talent + impact * 0.16, 0, 100);
  }

  if (decision.department === "capital") {
    district.stats.capital = clamp(district.stats.capital + impact * 0.9, 0, 100);
    district.stats.compute = clamp(district.stats.compute + impact * 0.4, 0, 100);
    district.stats.rentPressure = clamp(district.stats.rentPressure + impact * 0.12, 0, 100);
  }

  if (decision.department === "community") {
    district.stats.vibe = clamp(district.stats.vibe + impact * 0.85, 0, 100);
    district.stats.localBusiness = clamp(district.stats.localBusiness + impact * 0.7, 0, 100);
  }

  if (decision.department === "permits") {
    district.stats.permits = clamp(district.stats.permits + impact, 0, 100);
  }
}

function applyFounderDecisionLocal(state: CityState, founderId: string, decision: FounderDecision) {
  const founder = state.founders.find((entry) => entry.id === founderId);
  if (!founder) {
    return;
  }

  if (decision.speechBubble) {
    founder.speechBubble = decision.speechBubble;
  }

  if (decision.action === "reroute" || decision.action === "relocate") {
    founder.targetDistrict = decision.targetDistrict;
    founder.route = findShortestPath(founder.currentDistrict, decision.targetDistrict);
    founder.routeIndex = 0;
    founder.routeProgress = 0;
    founder.status = "relocating";
    return;
  }

  if (decision.action === "pivot") {
    founder.status = "pivoted";
    return;
  }

  if (decision.action === "stall") {
    founder.status = "stalled";
    return;
  }

  if (decision.action === "breakout") {
    founder.status = "breakout";
    founder.companyType = `${founder.companyType} Breakout`;
  }
}

function mergeRemotePlayerState(local: CityState, remote: CityState) {
  const next = cloneCity(local);
  const localById = new Map(local.playerStartups.map((startup) => [startup.id, startup]));
  const mergedStartups = remote.playerStartups.map((remoteStartup) => {
    const localStartup = localById.get(remoteStartup.id);
    if (!localStartup) {
      return remoteStartup;
    }

    if (remoteStartup.resolvedChoices.length > localStartup.resolvedChoices.length) {
      return remoteStartup;
    }

    if (!localStartup.activeChoiceRound && remoteStartup.activeChoiceRound) {
      return remoteStartup;
    }

    if (localStartup.activeChoiceRound && remoteStartup.activeChoiceRound) {
      if (localStartup.activeChoiceRound.id !== remoteStartup.activeChoiceRound.id) {
        return remoteStartup;
      }

      if (!localStartup.activeChoiceRound.selectedOptionId && remoteStartup.activeChoiceRound.selectedOptionId) {
        return remoteStartup;
      }
    }

    return localStartup;
  });

  const mergedIds = new Set(mergedStartups.map((startup) => startup.id));
  for (const localStartup of local.playerStartups) {
    if (!mergedIds.has(localStartup.id)) {
      mergedStartups.push(localStartup);
    }
  }

  next.playerStartups = mergedStartups;
  next.startupParcels = remote.startupParcels;
  next.audienceCount = remote.audienceCount;
  next.ticker = Array.from(new Set([...remote.ticker, ...local.ticker])).slice(0, 6);

  if (remote.status === "ended" && local.status !== "ended") {
    next.status = "ended";
    next.summary = remote.summary;
    next.headline = remote.headline;
    next.score = remote.score;
  }

  if (remote.playerStartups.length > local.playerStartups.length) {
    next.headline = remote.headline;
  }

  return next;
}

function formatScore(score: number) {
  return `${Math.round(score)}`;
}

export function CitySimulationClient({
  roomId,
  host,
  compact = false,
}: CitySimulationClientProps) {
  const [city, setCity] = useState<CityState | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("lobby");
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [selectedFounder, setSelectedFounder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cityRef = useRef<CityState | null>(null);
  const roomAudienceRef = useRef(0);

  const audienceKey = useMemo(() => selectAudienceKey(), []);

  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  const selectedFounderState = city?.founders.find((founder) => founder.id === selectedFounder) ?? null;
  const playerControlledStartups = city?.playerStartups.filter((startup) => startup.controlMode === "player") ?? [];
  const ambientStartups = city?.playerStartups.filter((startup) => startup.controlMode === "ambient") ?? [];
  const topStartups = playerControlledStartups
    ?.slice()
    .sort((left, right) => right.valuation - left.valuation)
    .slice(0, compact ? 3 : 6) ?? [];
  const joinUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URL(`/join/${roomId}`, window.location.origin).toString();
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${appUrl}/join/${roomId}`;
  }, [roomId]);

  const persistState = useCallback(async (state: CityState) => {
    if (!state.runId) {
      return;
    }

    let payloadState = state;
    try {
      const remoteResponse = await fetch(`/api/rooms/${roomId}/state`, { cache: "no-store" });
      const remotePayload = (await remoteResponse.json().catch(() => null)) as { run?: CityState | null } | null;
      if (remotePayload?.run) {
        payloadState = mergeRemotePlayerState(state, remotePayload.run);
      }
    } catch {
      payloadState = state;
    }

    await fetch("/api/runs/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: payloadState.runId, state: payloadState }),
    });
  }, [roomId]);

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

    return (await response.json().catch(() => null)) as {
      run?: CityState | null;
      room?: { status?: RoomStatus };
      error?: string;
    } | null;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const payload = await refresh();
      if (cancelled) {
        return;
      }

      setRoomLoaded(true);

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

      setCity((current) => {
        if (current && host) {
          return mergeRemotePlayerState(current, payload.run!);
        }
        return payload.run!;
      });
      setRoomStatus(payload.run.status === "ended" ? "ended" : payload.room?.status ?? "active");
      setMessage(null);
    };

    void poll();
    const interval = setInterval(() => void poll(), host ? 2_000 : compact ? 1_200 : 1_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [compact, host, refresh]);

  const startRun = useCallback(async () => {
    setMessage(null);
    const response = await fetch("/api/rooms/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        setMessage("Sign in to start the game.");
        if (typeof window !== "undefined") {
          window.location.href = "/sign-in";
        }
        return;
      }
      setMessage("Could not start run.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { run?: CityState };
    if (payload?.run) {
      setCity(payload.run);
      setRoomStatus(payload.run.status);
    }
  }, [roomId]);

  const castVote = useCallback(async (voteRound: VoteRound, optionId: string) => {
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
        voterKey: audienceKey,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { run?: CityState };
    if (payload?.run) {
      setCity((current) => (current && host ? mergeRemotePlayerState(current, payload.run!) : payload.run!));
    }
  }, [audienceKey, city, host, roomId]);

  const resolveVoteFromHost = useCallback(async () => {
    if (!city?.activeVoteRound || !host) {
      return;
    }

    if (city.elapsedMs < city.activeVoteRound.closesAt) {
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
    if (typeof window === "undefined" || !city?.runId) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(`city:${roomId}`, { config: { presence: { key: audienceKey } } });

    const flushAudience = (stateSnapshot?: unknown) => {
      const presence = (stateSnapshot ??
        (typeof channel.presenceState === "function" ? channel.presenceState() : {})) as Record<
        string,
        Array<{ role?: string }>
      >;

      let count = 0;
      for (const peers of Object.values(presence)) {
        if (Array.isArray(peers)) {
          count += peers.length;
        }
      }

      void notifyAudienceCount(city.runId, Math.max(count, 1));
    };

    channel
      .on("presence", { event: "sync" }, () => flushAudience())
      .on("presence", { event: "join" }, () => flushAudience())
      .on("presence", { event: "leave" }, () => flushAudience())
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            voterKey: audienceKey,
            role: host ? "host" : "audience",
            updatedAt: Date.now(),
          });
          flushAudience();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [audienceKey, city?.runId, host, notifyAudienceCount, roomId]);

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

        if (next.activeVoteRound && next.elapsedMs >= next.activeVoteRound.closesAt) {
          void resolveVoteFromHost();
        }

        if (next.status === "ended") {
          setMessage("Run ended. Open the report from the summary.");
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
            body: JSON.stringify({ city: latest, founderId: targetFounder.id }),
          })
            .then((response) => response.json())
            .then((payload) => payload as { decision?: FounderDecision })
            .catch(() => ({ decision: null }))
        : Promise.resolve({ decision: null } as { decision: FounderDecision | null });

      const managerTask = activeManager
        ? fetch("/api/agents/city-manager-tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ city: latest, managerId: activeManager.id }),
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
        : Promise.resolve({ decision: null } as { decision: PulseEventDecision | null });

      void Promise.all([founderTask, managerTask, pulseTask]).then(([founderPayload, managerPayload, pulsePayload]) => {
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
          if (pulsePayload.decision?.effectVector && pulsePayload.decision.headline) {
            next.ticker = [pulsePayload.decision.headline, ...next.ticker].slice(0, 6);
            for (const districtId of pulsePayload.decision.affectedDistricts ?? []) {
              const district = next.districts[districtId];
              if (!district) {
                continue;
              }
              for (const [key, value] of Object.entries(pulsePayload.decision.effectVector)) {
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
      });
    }, AGENT_TICK_INTERVAL_MS);

    return () => {
      clearInterval(tickInterval);
      clearInterval(agentInterval);
    };
  }, [host, persistState, resolveVoteFromHost]);

  if (!city) {
    return (
      <div className="grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/68 p-4 text-slate-100 backdrop-blur">
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          <h1 className="text-xl font-semibold text-white">Founder City Session</h1>
          <p className="mt-1 text-sm text-slate-300">
            Room {roomId}
            <span className="ml-2 rounded-full border border-white/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-300">
              {roomStatus}
            </span>
          </p>
          {message ? <p className="mt-3 rounded-2xl bg-white/6 p-3 text-sm text-slate-200">{message}</p> : null}
        </div>

        {host && roomStatus === "lobby" ? (
          <button
            onClick={startRun}
            className="rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            Start Run
          </button>
        ) : null}

        {!roomLoaded ? <p className="text-sm text-slate-300">Loading city state...</p> : null}
      </div>
    );
  }

  const voteProgressMs = city.activeVoteRound
    ? clamp(city.activeVoteRound.closesAt - city.elapsedMs, 0, VOTE_WINDOW_MS)
    : null;

  if (compact) {
    return (
      <div className="grid gap-4">
        <CityMapScene
          state={city}
          selectedFounderId={selectedFounder}
          onSelectFounder={setSelectedFounder}
          compact
        />

        <section className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/72 p-4 text-slate-100">
          <div>
            <h1 className="text-lg font-semibold text-white">{city.headline}</h1>
            <p className="mt-1 text-sm text-slate-300">
              Remaining {formatRelativeMs(city.remainingMs)} · Player towers {playerControlledStartups.length} · Audience {city.audienceCount}
            </p>
          </div>

          <div className="grid gap-3">
            <ScoreBar label="Startup Survival" score={city.score.startupSurvival} />
            <ScoreBar label="Vibe Index" score={city.score.vibeIndex} />
          </div>

          {city.activeVoteRound ? (
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/4 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Audience Vote · {voteProgressMs !== null ? `${Math.ceil(voteProgressMs / 1000)}s` : "closed"}
              </p>
              <p className="text-sm text-slate-200">{city.activeVoteRound.prompt}</p>
              <div className="grid gap-2">
                {city.activeVoteRound.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => castVote(city.activeVoteRound!, option.id)}
                    className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm text-white"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,0.9fr)]">
        <CityMapScene
          state={city}
          selectedFounderId={selectedFounder}
          onSelectFounder={setSelectedFounder}
        />

        <aside className="grid gap-4">
          <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
              Live Run
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{city.headline}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Room {roomId} · Tick {city.tick} · Remaining {formatRelativeMs(city.remainingMs)}
            </p>
            <p className="text-sm text-slate-400">
              Audience {city.audienceCount} · Live founders {playerControlledStartups.length} · Ambient skyline {ambientStartups.length}
            </p>

            {host && city.status !== "active" ? (
              <button
                onClick={startRun}
                className="mt-4 w-full rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Start Run
              </button>
            ) : null}

            {city.status === "ended" ? (
              <Link
                href={`/report/${city.runId}`}
                className="mt-4 inline-flex w-full justify-center rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Open City Report
              </Link>
            ) : null}
          </section>

          <section className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
                  Join Live
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">Scan to plant a tower</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
                  Join the room, name a startup, add a short idea, and keep choosing between two moves while your AI company climbs or collapses on the skyline.
                </p>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-200">
                {playerControlledStartups.length} live
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[144px_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-white/8 bg-white/5 p-3">
                <QRCodeSVG
                  value={joinUrl}
                  size={120}
                  bgColor="transparent"
                  fgColor="#f8fafc"
                  className="h-full w-full"
                  includeMargin
                />
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-400">
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                    <p>Audience</p>
                    <p className="mt-1 text-lg font-semibold tracking-normal text-white">{city.audienceCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                    <p>Player towers</p>
                    <p className="mt-1 text-lg font-semibold tracking-normal text-white">{playerControlledStartups.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                    <p>Skyline fill</p>
                    <p className="mt-1 text-lg font-semibold tracking-normal text-white">{ambientStartups.length}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-300">
                  {joinUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/70">
                  Audience Towers
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">Top live startups</h2>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                Tower watch
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {topStartups.length > 0 ? topStartups.map((startup) => (
                <div key={startup.id} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 ring-1 ring-white/12"
                        style={{ background: `radial-gradient(circle at 30% 20%, ${startup.brandColor}, #020617 72%)` }}
                      >
                        {startup.logoDataUrl && startup.logoDataUrl.trim() ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={startup.logoDataUrl ?? undefined} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-white">
                            {startup.logoMonogram}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{startup.name}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          {city.districts[startup.districtId].label} · {startup.status}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">{startup.aiAction}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-amber-200">{Math.round(startup.buildingHeight)}m</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                  No player startups yet. Have the audience join from mobile and plant a tower in the city.
                </p>
              )}
            </div>
          </section>

          {selectedFounderState ? (
            <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
                Founder Agent
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{selectedFounderState.name}</h2>
              <p className="mt-2 text-sm text-slate-300">{selectedFounderState.pitch}</p>
              <p className="mt-3 text-sm text-slate-200">Company: {selectedFounderState.companyType}</p>
              <p className="text-sm text-slate-400">Status: {selectedFounderState.status}</p>
              <p className="mt-3 rounded-2xl border border-white/8 bg-white/4 p-3 text-sm text-slate-200">
                {selectedFounderState.speechBubble}
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
            City Metrics
          </p>
          <div className="mt-4 grid gap-3">
            <ScoreBar label="Startup Survival" score={city.score.startupSurvival} />
            <ScoreBar label="Commute Health" score={city.score.commuteHealth} />
            <ScoreBar label="Local Business" score={city.score.localBusiness} />
            <ScoreBar label="Vibe Index" score={city.score.vibeIndex} />
            <ScoreBar label="Neighborhood Balance" score={city.score.neighborhoodBalance} />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/70">
            Audience Vote
          </p>
          {city.activeVoteRound ? (
            <div className="mt-3 grid gap-3">
              <p className="text-sm text-slate-200">{city.activeVoteRound.prompt}</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                {voteProgressMs !== null ? `${Math.ceil(voteProgressMs / 1000)}s remaining` : "closed"}
              </p>
              <div className="grid gap-2">
                {city.activeVoteRound.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => castVote(city.activeVoteRound!, option.id)}
                    className="rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-left text-sm text-white hover:border-white/24"
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-300">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No citywide audience vote is open right now.</p>
          )}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
            City Managers
          </p>
          <div className="mt-3 grid gap-2">
            {city.managers.map((manager) => (
              <div key={manager.id} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                <p className="font-semibold text-white">{manager.name}</p>
                <p className="text-sm text-slate-300">{manager.speechBubble}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {manager.department} · {city.districts[manager.targetDistrict].label} · impact {formatScore(manager.impact)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 text-slate-100 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
          Live Ticker
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-slate-300">
          {city.ticker.map((entry, index) => (
            <li key={`${index}-${entry}`} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              {entry}
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="rounded-2xl bg-rose-500/16 px-4 py-3 text-sm text-rose-100">{message}</p> : null}
    </div>
  );
}
