import Link from "next/link";

import { createRunSummary } from "@/lib/sim/engine";
import { getRunByRunId, getRunRecordByRunId } from "@/lib/data/store";

type ReportPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export const revalidate = 0;

export const metadata = {
  title: "Founder City Report",
  description: "End-of-run city summary for Founder City.",
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { runId } = await params;
  const run = await getRunByRunId(runId);
  const record = await getRunRecordByRunId(runId);

  if (!run) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6 text-zinc-200">
        <p>Report not found. Start a session from the lobby.</p>
      </main>
    );
  }

  const summary = run.summary ?? createRunSummary(run);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
      <h1 className="text-3xl font-black text-cyan-200">{summary.headline}</h1>
      <p className="text-zinc-300">{summary.dek}</p>
      <p className="text-sm text-zinc-400">City personality: {summary.cityPersonality}</p>

      <section className="grid gap-4 rounded-xl border border-zinc-700/60 bg-zinc-950/70 p-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold text-zinc-100">City Score</h2>
          <ul className="grid gap-2 text-sm text-zinc-300">
            <li>Startup Survival: {Math.round(summary.score.startupSurvival)}</li>
            <li>Commute Health: {Math.round(summary.score.commuteHealth)}</li>
            <li>Local Business: {Math.round(summary.score.localBusiness)}</li>
            <li>Vibe Index: {Math.round(summary.score.vibeIndex)}</li>
            <li>Neighborhood Balance: {Math.round(summary.score.neighborhoodBalance)}</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-zinc-100">Run Metadata</h2>
          <ul className="grid gap-2 text-sm text-zinc-300">
            <li>Room: {run.roomId}</li>
            <li>Status: {record?.status ?? run.status}</li>
            <li>Seed: {run.seed}</li>
            <li>Run ID: {run.runId}</li>
            <li>Finalized: {record?.endedAt || run.status === "ended" ? "Yes" : "No"}</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-zinc-700/60 bg-zinc-950/70 p-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold text-zinc-100">District Outcomes</h2>
          <ul className="grid gap-1 text-sm text-zinc-300">
            {summary.districtOutcomes.map((line) => (
              <li key={line} className="list-disc pl-1">
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-zinc-100">Founder Outcomes</h2>
          <ul className="grid gap-1 text-sm text-zinc-300">
            {summary.founderOutcomes.map((line) => (
              <li key={line} className="list-disc pl-1">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700/60 bg-zinc-950/70 p-4">
        <h2 className="mb-2 font-semibold text-zinc-100">Notable Interventions</h2>
        <ul className="grid gap-1 text-sm text-zinc-300">
          {summary.notableInterventions.map((line) => (
            <li key={line} className="list-disc pl-1">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-700/60 bg-zinc-950/70 p-4">
        <h2 className="mb-2 font-semibold text-zinc-100">Shareable Artifact</h2>
        <p className="text-sm text-zinc-300">
          Keep this page as your post-run summary card for quick debriefs, demo days, and team retros.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/play" className="inline-flex rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200">
            Start New Run
          </Link>
          <Link
            href={`/city/${run.roomId}`}
            className="inline-flex rounded-md border border-zinc-600 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-cyan-300/80 hover:text-cyan-200"
          >
            Reopen Room
          </Link>
        </div>
      </section>
    </main>
  );
}
