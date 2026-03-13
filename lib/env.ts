import { z } from "zod";

const StringEnv = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const envSchema = z.object({
  nodeEnv: z
    .enum(["production", "development", "test"])
    .default("development")
    .catch("development"),
  appUrl: z
    .string()
    .trim()
    .default("http://localhost:3000")
    .transform((value) => value || "http://localhost:3000"),
  openAiApiKey: StringEnv,
  openAiModel: z.string().trim().default("gpt-5.2"),
  stackProjectId: StringEnv,
  stackPublishableClientKey: StringEnv,
  stackSecretServerKey: StringEnv,
  supabaseUrl: StringEnv,
  supabaseAnonKey: StringEnv,
  supabaseServiceRoleKey: StringEnv,
}).superRefine((value, context) => {
  if (value.supabaseUrl && !value.supabaseUrl.startsWith("http")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SUPABASE URL must be an HTTP(S) URL",
      path: ["supabaseUrl"],
    });
  }

  const appUrlValue = value.appUrl;
  if (!appUrlValue || !z.url().safeParse(appUrlValue).success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid NEXT_PUBLIC_APP_URL",
      path: ["appUrl"],
    });
  }
});

const parsedEnv = envSchema.safeParse({
  nodeEnv: process.env.NODE_ENV,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL,
  stackProjectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  stackPublishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  stackSecretServerKey: process.env.STACK_SECRET_SERVER_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsedEnv.success && process.env.NODE_ENV === "production") {
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`)
      .join(", ")}`,
  );
}

if (!parsedEnv.success) {
  if (process.env.NODE_ENV !== "production") {
    const issueSummary = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".") || "env"} ${issue.message}`)
      .join(", ");
    console.warn(`[founder-city] Environment fallback used: ${issueSummary}`);
  }
}

const env = {
  nodeEnv: parsedEnv.success
    ? parsedEnv.data.nodeEnv
    : "development",
  appUrl: parsedEnv.success ? parsedEnv.data.appUrl : "http://localhost:3000",
  openAiApiKey: parsedEnv.success ? parsedEnv.data.openAiApiKey : undefined,
  openAiModel: parsedEnv.success ? parsedEnv.data.openAiModel : "gpt-5.2",
  stackProjectId: parsedEnv.success ? parsedEnv.data.stackProjectId : undefined,
  stackPublishableClientKey: parsedEnv.success
    ? parsedEnv.data.stackPublishableClientKey
    : undefined,
  stackSecretServerKey: parsedEnv.success
    ? parsedEnv.data.stackSecretServerKey
    : undefined,
  supabaseUrl: parsedEnv.success ? parsedEnv.data.supabaseUrl : undefined,
  supabaseAnonKey: parsedEnv.success ? parsedEnv.data.supabaseAnonKey : undefined,
  supabaseServiceRoleKey: parsedEnv.success ? parsedEnv.data.supabaseServiceRoleKey : undefined,
};

export function isStackConfigured() {
  return Boolean(
    env.stackProjectId &&
      env.stackPublishableClientKey &&
      env.stackSecretServerKey,
  );
}

export function isSupabaseConfigured() {
  return Boolean(
    env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey,
  );
}

export function isOpenAiConfigured() {
  return Boolean(env.openAiApiKey);
}

export function isDemoMode() {
  return env.nodeEnv !== "production" || !isStackConfigured();
}

export { env };
