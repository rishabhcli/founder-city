import { Suspense } from "react";
import { StackHandler, StackTheme } from "@stackframe/stack";
import { StackFallbackPanel } from "@/components/auth/StackFallbackPanel";

export default function StackHandlerPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6 md:p-10">
      <Suspense fallback={<StackFallbackPanel />}>
        <StackTheme>
          <StackHandler fullPage />
        </StackTheme>
      </Suspense>
    </main>
  );
}
