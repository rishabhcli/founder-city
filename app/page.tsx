import { Suspense } from "react";
import Link from "next/link";
import { StackUserMenu } from "@/components/auth/StackUserMenu";

export const metadata = {
  title: "Founder City",
  description: "San Francisco runs itself. So can your startup map.",
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-cyan-300/75">Founder City</p>
          <p className="mt-2 text-sm text-slate-400">Live startup ecosystem rendered as a shared 3D San Francisco skyline.</p>
        </div>
        <Suspense fallback={null}>
          <StackUserMenu />
        </Suspense>
      </div>

      <section className="rounded-[32px] border border-white/10 bg-slate-950/72 p-6 md:p-8">
        <p className="inline-flex rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold tracking-[0.34em] text-amber-200/80">
          ACTUAL CITY MODE
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
          Watch startup towers rise and fail across a live 3D San Francisco.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Every company becomes a building. AI founders, managers, and player-owned startups reshape the skyline in real time while
          mobile players steer their companies through timed strategy rounds.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/play"
            className="inline-flex rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Open City Lobby
          </Link>
          <Link
            href="/play"
            className="inline-flex rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-white hover:border-cyan-300/80 hover:text-cyan-200"
          >
            Create or Join a Room
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/72 p-5">
          <h2 className="text-lg font-semibold text-white">3D City Scene</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The big screen renders a real SF basemap with district towers, player startup parcels, and live AI motion.
          </p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-950/72 p-5">
          <h2 className="text-lg font-semibold text-white">Player Startups</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Logged-in players plant a company into the shared city and watch their own building grow, wobble, or die.
          </p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-950/72 p-5">
          <h2 className="text-lg font-semibold text-white">Timed Choices</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Mobile rounds shape strategy while the AI stays in control of execution, growth, and survival.
          </p>
        </div>
      </section>
    </main>
  );
}
