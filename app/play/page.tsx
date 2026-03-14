import { Suspense } from "react";
import { PlayClient } from "@/components/play/PlayClient";
import { StackUserMenu } from "@/components/auth/StackUserMenu";
import { redirect } from "next/navigation";
import { getStackUser } from "@/lib/stack/server";

export const metadata = {
  title: "Founder City Play",
  description: "Create or join a Founder City room.",
};

export default async function PlayPage() {
  const user = await getStackUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-6 md:p-10">
      <div className="flex justify-end">
        <Suspense fallback={null}>
          <StackUserMenu />
        </Suspense>
      </div>
      <PlayClient />
    </main>
  );
}
