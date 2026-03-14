"use client";

import dynamic from "next/dynamic";

const StackUserMenuClient = dynamic(
  () =>
    import("@/components/auth/StackUserMenuClient").then(
      (module) => module.StackUserMenuClient,
    ),
  {
    ssr: false,
  },
);

export function StackUserMenu() {
  return <StackUserMenuClient />;
}
