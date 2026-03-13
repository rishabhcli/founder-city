"use client";

import { env, isStackConfigured } from "@/lib/env";

type GenericStackClient = {
  handler?: (...args: unknown[]) => unknown;
  SignIn?: unknown;
  SignUp?: unknown;
  UserButton?: unknown;
  AccountSettings?: unknown;
};

type StackClientConstructor = new (options: {
  projectId: string | undefined;
  publishableClientKey: string | undefined;
  tokenStore: "cookie";
  redirectMethod: "nextjs";
}) => GenericStackClient;

let client: GenericStackClient | null = null;

export async function getStackClientApp(): Promise<GenericStackClient | null> {
  if (!isStackConfigured()) {
    return null;
  }

  if (client) {
    return client;
  }

  try {
    const stack = await import("@stackframe/stack");
    const StackClientApp = (stack as {
      StackClientApp?: StackClientConstructor;
    }).StackClientApp;
    if (typeof StackClientApp !== "function") {
      return null;
    }
    client = new StackClientApp({
      projectId: env.stackProjectId,
      publishableClientKey: env.stackPublishableClientKey,
      tokenStore: "cookie",
      redirectMethod: "nextjs",
    });
    return client;
  } catch {
    return null;
  }
}
