"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Sparkles, Wand2 } from "lucide-react";

import {
  DISTRICT_IDS,
  type CityState,
  type DistrictId,
  type PlayerChoiceOption,
  type PlayerStartupState,
} from "@/lib/types/city";
import { cn } from "@/lib/utils";

type PlayerStartupControlsProps = {
  roomId: string;
  viewerUserId: string | null;
  authEnabled: boolean;
};

function getViewerKey() {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem("founder-city-player");
  if (existing) {
    return existing;
  }

  const next = Math.random().toString(36).slice(2, 10);
  window.localStorage.setItem("founder-city-player", next);
  return next;
}

function startupOwnerId(viewerUserId: string | null, viewerKey: string) {
  return viewerUserId ?? `demo-${viewerKey}`;
}

function districtLabel(city: CityState | null, districtId: DistrictId) {
  return city?.districts[districtId]?.label ?? districtId;
}

function optionToneClass(option: PlayerChoiceOption) {
  if (option.outlook === "surge") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-50";
  }

  if (option.outlook === "risk") {
    return "border-rose-300/25 bg-rose-300/10 text-rose-50";
  }

  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-50";
}

export function PlayerStartupControls({
  roomId,
  viewerUserId,
  authEnabled,
}: PlayerStartupControlsProps) {
  const viewerKey = useMemo(() => getViewerKey(), []);
  const [city, setCity] = useState<CityState | null>(null);
  const [startupName, setStartupName] = useState("Fogline");
  const [description, setDescription] = useState(
    "AI tooling for neighborhood retailers who want better repeat demand without losing local character.",
  );
  const [districtId, setDistrictId] = useState<DistrictId>("mission");
  const [previewLogoDataUrl, setPreviewLogoDataUrl] = useState<string | null>(null);
  const [previewBrandColor, setPreviewBrandColor] = useState("#4de2ff");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const response = await fetch(`/api/rooms/${roomId}/state`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { run?: CityState | null } | null;
      if (!cancelled) {
        setCity(payload?.run ?? null);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId]);

  const ownerId = startupOwnerId(viewerUserId, viewerKey);
  const startup =
    city?.playerStartups.find(
      (entry) => entry.controlMode === "player" && entry.ownerUserId === ownerId,
    ) ?? null;

  async function handleGenerateName() {
    setGeneratingName(true);
    setMessage(null);

    const response = await fetch("/api/startups/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        districtId,
        description,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      name?: string;
      previewLogoDataUrl?: string;
      brandColor?: string;
      error?: string;
    };

    if (!response.ok || !payload?.name) {
      setMessage(payload?.error ?? "Could not generate a startup name.");
      setGeneratingName(false);
      return;
    }

    setStartupName(payload.name);
    setPreviewLogoDataUrl(payload.previewLogoDataUrl ?? null);
    setPreviewBrandColor(payload.brandColor ?? "#4de2ff");
    setGeneratingName(false);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/startups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        name: startupName,
        description,
        districtId,
        viewerKey,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      run?: CityState;
      error?: string;
    };

    if (!response.ok) {
      setMessage(payload?.error ?? "Could not launch startup.");
      setBusy(false);
      return;
    }

    setCity(payload?.run ?? null);
    setBusy(false);
  }

  async function submitChoice(startupState: PlayerStartupState, optionId: string) {
    if (!startupState.activeChoiceRound) {
      return;
    }

    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/startups/choice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        choiceRoundId: startupState.activeChoiceRound.id,
        optionId,
        viewerKey,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      run?: CityState;
      error?: string;
    };

    if (!response.ok) {
      setMessage(payload?.error ?? "Could not submit choice.");
      setBusy(false);
      return;
    }

    setCity(payload?.run ?? null);
    setBusy(false);
  }

  if (!city) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-slate-950/76 p-5 text-slate-100">
        <p className="text-sm text-slate-300">Waiting for the city to go live.</p>
      </section>
    );
  }

  if (!viewerUserId && authEnabled) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-slate-950/78 p-5 text-slate-100 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300/75">
          Player Access
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white">
          Sign in to launch a startup into the skyline.
        </h2>
        <div className="mt-4 flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-white/16 px-4 py-2 text-sm font-semibold text-white"
          >
            Create account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/76 p-5 text-slate-100 backdrop-blur">
      {!startup ? (
        <form onSubmit={handleCreate} className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
              Launch a Startup
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Add your company to the city.
            </h2>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/4 p-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Startup name
              </label>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  value={startupName}
                  onChange={(event) => setStartupName(event.target.value)}
                  maxLength={40}
                  placeholder="Name your tower"
                />
                <button
                  type="button"
                  onClick={() => void handleGenerateName()}
                  disabled={generatingName || description.trim().length < 8}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {generatingName ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Generate
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                What are you building?
              </label>
              <textarea
                className="min-h-[108px] rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none placeholder:text-slate-500"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={180}
                placeholder="Short idea. Example: AI copilot for biotech lab ops in Mission Bay."
              />
            </div>

            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Home district
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DISTRICT_IDS.map((district) => (
                  <button
                    key={district}
                    type="button"
                    onClick={() => setDistrictId(district)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left text-sm transition",
                      district === districtId
                        ? "border-cyan-300/70 bg-cyan-300/14 text-white"
                        : "border-white/10 bg-white/4 text-slate-200",
                    )}
                  >
                    {districtLabel(city, district)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))] p-4">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/90 shadow-[0_20px_48px_rgba(15,23,42,0.48)]"
                style={{ background: `radial-gradient(circle at 30% 20%, ${previewBrandColor}, #020617 72%)` }}
              >
                {previewLogoDataUrl && previewLogoDataUrl.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewLogoDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="h-8 w-8 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/72">
                  Tower preview
                </p>
                <h3 className="truncate text-xl font-semibold text-white">{startupName || "Untitled startup"}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {districtLabel(city, districtId)} · live AI-run growth loop
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || startupName.trim().length < 2 || description.trim().length < 12}
              className="rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Generating tower..." : "Launch into the skyline"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))] p-4">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/90"
                style={{ background: `radial-gradient(circle at 30% 20%, ${startup.brandColor}, #020617 72%)` }}
              >
                {startup.logoDataUrl && startup.logoDataUrl.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={startup.logoDataUrl ?? undefined} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-black uppercase tracking-[0.18em] text-white">
                    {startup.logoMonogram}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200/75">
                  Your Startup
                </p>
                <h2 className="truncate text-2xl font-semibold text-white">{startup.name}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {districtLabel(city, startup.districtId)} · {startup.status}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs uppercase tracking-[0.18em] text-slate-400">
              <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                <p>Tower</p>
                <p className="mt-1 text-lg font-semibold tracking-normal text-white">{Math.round(startup.buildingHeight)}m</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                <p>Cash</p>
                <p className="mt-1 text-lg font-semibold tracking-normal text-white">{Math.round(startup.cash)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                <p>Traction</p>
                <p className="mt-1 text-lg font-semibold tracking-normal text-white">{Math.round(startup.traction)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-2 py-3">
                <p>Value</p>
                <p className="mt-1 text-lg font-semibold tracking-normal text-white">{startup.valuation}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200">
              {startup.aiMood}
            </div>
          </div>

          {startup.activeChoiceRound ? (
            <div className="grid gap-3 rounded-[28px] border border-amber-300/20 bg-amber-300/8 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/75">
                  Live Decision
                </p>
                <p className="mt-2 text-base leading-7 text-white">
                  {startup.activeChoiceRound.prompt}
                </p>
              </div>

              <div className="grid gap-3">
                {startup.activeChoiceRound.options.map((option) => {
                  const selected = startup.activeChoiceRound?.selectedOptionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void submitChoice(startup, option.id)}
                      disabled={busy}
                      className={cn(
                        "rounded-[24px] border px-4 py-4 text-left transition",
                        optionToneClass(option),
                        selected && "ring-2 ring-white/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">{option.label}</p>
                          <p className="mt-1 text-sm leading-6 text-white/80">{option.description}</p>
                        </div>
                        <span className="rounded-full border border-white/14 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/72">
                          {option.outlook}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/4 px-4 py-4 text-sm text-slate-300">
              Your AI is currently executing. The next decision will appear automatically.
            </div>
          )}
        </div>
      )}

      {message ? <p className="rounded-2xl bg-rose-500/16 px-4 py-3 text-sm text-rose-100">{message}</p> : null}
    </section>
  );
}
