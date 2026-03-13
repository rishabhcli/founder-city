import { env, isStackConfigured } from "@/lib/env";

type GenericStackApp = {
  getUser?: (options?: unknown) => Promise<unknown | null>;
};

type StackServerAppOptions = {
  projectId: string | undefined;
  publishableClientKey: string | undefined;
  secretServerKey: string | undefined;
  tokenStore: "nextjs-cookie";
};

type StackServerAppConstructor = new (
  options: StackServerAppOptions,
) => GenericStackApp;

let app: GenericStackApp | null = null;

export async function getStackServerApp(): Promise<GenericStackApp | null> {
  if (!isStackConfigured()) {
    return null;
  }

  if (app) {
    return app;
  }

  try {
    const stack = await import("@stackframe/stack");
    const StackServerApp = (stack as {
      StackServerApp?: StackServerAppConstructor;
    }).StackServerApp;
    if (typeof StackServerApp !== "function") {
      return null;
    }

    app = new StackServerApp({
      projectId: env.stackProjectId,
      publishableClientKey: env.stackPublishableClientKey,
      secretServerKey: env.stackSecretServerKey,
      tokenStore: "nextjs-cookie",
    });
    return app;
  } catch {
    return null;
  }
}

export async function getStackUser(): Promise<unknown | null> {
  const stack = await getStackServerApp();
  if (!stack?.getUser) {
    return null;
  }

  try {
    return await stack.getUser();
  } catch {
    return null;
  }
}
