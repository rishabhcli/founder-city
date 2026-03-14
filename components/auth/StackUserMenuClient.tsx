"use client";

import { UserButton } from "@stackframe/stack";

function hasStackClientKeys() {
  return Boolean(
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID &&
      process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  );
}

export function StackUserMenuClient() {
  if (!hasStackClientKeys()) {
    return null;
  }

  return <UserButton showUserInfo={false} />;
}
