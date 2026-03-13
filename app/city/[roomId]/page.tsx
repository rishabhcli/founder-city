import { CitySimulationClient } from "@/components/city/CitySimulationClient";
import { isDemoMode } from "@/lib/env";
import { getStackUser } from "@/lib/stack/server";
import { redirect } from "next/navigation";

type CityRoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    host?: string;
  }>;
};

export default async function CityRoomPage(props: CityRoomPageProps) {
  const { roomId } = await props.params;
  const { host } = await props.searchParams;

  if (host === "1" && !isDemoMode()) {
    const user = await getStackUser();
    if (!user) {
      redirect("/sign-in");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl px-4 py-6 md:px-8">
      <CitySimulationClient roomId={roomId} host={host === "1"} />
    </main>
  );
}
