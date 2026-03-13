import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let supabaseServerClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient(
      env.supabaseUrl!,
      env.supabaseServiceRoleKey ?? env.supabaseAnonKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  return supabaseServerClient;
}

