import Link from "next/link";
import { CitySimulationClient } from "@/components/city/CitySimulationClient";

type JoinRoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export const metadata = {
  title: "Join Founder City",
  description: "Join a live Founder City session as audience.",
};

export default async function JoinRoomPage(props: JoinRoomPageProps) {
  const { roomId } = await props.params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4 md:px-8 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-cyan-200">Founder City Audience View</h1>
        <Link
          href="/play"
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          Back to Lobby
        </Link>
      </div>

      <p className="max-w-3xl text-sm text-zinc-300">
        Join this session by voting on live interventions and watching founder agents reshape San Francisco in real time.
      </p>

      <CitySimulationClient roomId={roomId} host={false} compact />
    </main>
  );
}
