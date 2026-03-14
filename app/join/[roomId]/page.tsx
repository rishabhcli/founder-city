import Link from "next/link";
import { CitySimulationClient } from "@/components/city/CitySimulationClient";
import { PlayerStartupControls } from "@/components/mobile/PlayerStartupControls";
import { getStackUserId } from "@/lib/stack/server";
import { isStackConfigured } from "@/lib/env";

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
  const viewerUserId = await getStackUserId();
  const authEnabled = isStackConfigured();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
            Founder City
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Join the skyline from your phone</h1>
        </div>
        <Link
          href="/play"
          className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Lobby
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.35fr)]">
        <PlayerStartupControls
          roomId={roomId}
          viewerUserId={viewerUserId}
          authEnabled={authEnabled}
        />
        <CitySimulationClient roomId={roomId} host={false} compact />
      </div>
    </main>
  );
}
