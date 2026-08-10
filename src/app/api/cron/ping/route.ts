import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Лёгкий пинг базы, чтобы бесплатный проект Supabase не «засыпал» после недели простоя.
 * Вызывается по расписанию (Vercel Cron, см. vercel.json).
 */
export async function GET() {
  try {
    const db = supabaseAdmin();
    await db.from("settings").select("id").limit(1);
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
