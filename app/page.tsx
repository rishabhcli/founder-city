import Link from "next/link";

export const metadata = {
  title: "Founder City",
  description: "San Francisco runs itself. So can your startup map.",
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-8">
      <section className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 md:p-8">
        <p className="inline-flex rounded-full border border-zinc-600/80 px-3 py-1 text-xs font-semibold tracking-wider text-cyan-200">
          FOUNDER CITY
        </p>
        <h1 className="mt-4 text-4xl font-black leading-tight text-zinc-100 md:text-5xl">
          Live city simulation for startup ecosystems
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-zinc-300">
          Founders are not just icons. They are startup agents moving through a stylized San Francisco board, changing into companies
          based on where the city sends them.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/play"
            className="inline-flex rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-fuchsia-400"
          >
            Open City Lobby
          </Link>
          <Link
            href="/play"
            className="inline-flex rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-cyan-300/80 hover:text-cyan-200"
          >
            Create or Join a Room
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Hero Agents</h2>
          <p className="mt-2 text-sm text-zinc-300">
            5 founder agents and 4 city-manager agents make visible choices about routes, permits, transit, capital, and community.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Audience Voting</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Audience members get live intervention prompts every round—transit, grants, culture, and permit speedups.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">End Artifact</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Every run produces a report card with startup outcomes, district results, and a city headline.
          </p>
        </div>
      </section>
    </main>
  );
}
