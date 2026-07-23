import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Серверный Supabase-клиент с service-role ключом.
 * ВНИМАНИЕ: обходит RLS. Использовать ТОЛЬКО в серверном коде
 * (route handlers / server actions), никогда не отдавать в браузер.
 */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
