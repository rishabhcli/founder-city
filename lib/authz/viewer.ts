import { isDemoMode } from "@/lib/env";
import { getStackUserId } from "@/lib/stack/server";

export async function resolveViewerIdentity(viewerKey?: string | null) {
  if (isDemoMode()) {
    const stableDemoKey = viewerKey?.trim() || "demo-viewer";
    return {
      userId: `demo-${stableDemoKey}`,
      label: `Demo ${stableDemoKey.slice(-4).toUpperCase()}`,
    };
  }

  const userId = await getStackUserId();
  if (!userId) {
    return null;
  }

  return {
    userId,
    label: `Player ${userId.slice(-4)}`,
  };
}
