"use client";

import { isStackConfigured } from "@/lib/env";

export function StackFallbackPanel() {
  const configured = isStackConfigured();

  if (!configured) {
    return (
      <div className="auth-panel">
        <h1 className="text-2xl font-bold">Founder City is running in demo mode</h1>
        <p className="mt-2 text-sm opacity-80">
          Stack Auth is not configured in this environment, so demo mode is enabled.
          You can still create rooms and run live sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <h1 className="text-2xl font-bold">Auth is enabled</h1>
      <p className="mt-2 text-sm opacity-80">
        In a configured environment, this area can be swapped to Stack SignIn/SignUp components.
      </p>
    </div>
  );
}

