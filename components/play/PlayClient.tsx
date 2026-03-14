"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function PlayClient() {
  const router = useRouter();
  const [name, setName] = useState("Founder City Session");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/rooms/create", {
      method: "POST",
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json().catch(() => null)) as {
      room?: { id: string };
    };
    if (!response.ok || !payload?.room?.id) {
      setMessage("Could not create room. Try again.");
      setBusy(false);
      return;
    }

    router.push(`/city/${payload.room.id}?host=1`);
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.trim() }),
    });
    const payload = (await response.json().catch(() => null)) as {
      room?: { id: string };
      error?: string;
    };

    if (!response.ok || !payload?.room?.id) {
      setMessage(payload?.error ?? "Join code not valid.");
      setBusy(false);
      return;
    }

    router.push(`/city/${payload.room.id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[32px] border border-white/10 bg-slate-950/72 p-8 text-white">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">City Lobby</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Open a shared skyline</h1>
      </div>
      <p className="max-w-2xl text-slate-300">
        Launch a room, project the 3D San Francisco map on the big screen, and let the audience join from mobile to create and guide their own startups inside the city.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
          <h2 className="text-lg font-semibold">Create host room</h2>
          <label htmlFor="room-name" className="mt-3 block text-sm">
            Room name
          </label>
          <input
            id="room-name"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition disabled:opacity-60"
            onClick={createRoom}
          >
            Create + Start on Display
          </button>
          <p className="mt-3 text-xs text-slate-400">
            You will be redirected to the city board with host control.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
          <h2 className="text-lg font-semibold">Join with invite code</h2>
          <form onSubmit={joinRoom} className="mt-1 flex flex-col gap-2">
            <label htmlFor="invite-code" className="text-sm">
              Invite code
            </label>
            <input
              id="invite-code"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
            <button
              type="submit"
              disabled={busy || inviteCode.trim().length === 0}
              className="rounded-full bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition disabled:opacity-60"
            >
              Join Room
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">Examples: FC-AB12 or any provided join code.</p>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/4 p-5">
        <h2 className="text-lg font-semibold">Audience entry</h2>
        <p className="mt-2 text-sm text-slate-300">
          Anyone with a room code can join as audience at <span className="font-mono text-white">/join/&lt;roomId&gt;</span> and
          vote through intervention windows.
        </p>
      </section>

      {message ? <p className="rounded-2xl bg-red-500/20 p-3 text-sm text-red-100">{message}</p> : null}
    </main>
  );
}
