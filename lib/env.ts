const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.2",
  stackProjectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  stackPublishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  stackSecretServerKey: process.env.STACK_SECRET_SERVER_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
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

