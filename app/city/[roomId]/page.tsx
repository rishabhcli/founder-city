import { Suspense } from "react";
import { CitySimulationClient } from "@/components/city/CitySimulationClient";
import { StackUserMenu } from "@/components/auth/StackUserMenu";
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

  if (host === "1") {
    const user = await getStackUser();
    if (!user) {
      redirect("/sign-in");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-4 py-6 md:px-8">
      <div className="flex justify-end">
        <Suspense fallback={null}>
          <StackUserMenu />
        </Suspense>
      </div>
      <CitySimulationClient roomId={roomId} host={host === "1"} />
    </main>
  );
}
