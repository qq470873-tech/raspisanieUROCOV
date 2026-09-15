import "server-only";
import { supabaseAdmin } from "./supabase";

export interface Homework {
  id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  text: string;
  updated_at: string;
}

export async function listHomework(studentId: string): Promise<Homework[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("homework")
    .select("id, student_id, date, text, updated_at")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  return (data ?? []) as Homework[];
}

/** Сохраняет ДЗ на дату (одна запись на ученика+дату — при повторе обновляет текст). */
export async function saveHomework(studentId: string, date: string, text: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("homework")
    .select("id")
    .eq("student_id", studentId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("homework")
      .update({ text, updated_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("homework").insert({ student_id: studentId, date, text });
    if (error) throw new Error(error.message);
  }
}

export async function deleteHomework(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("homework").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Последние ДЗ (с именем ученика) — для контекста ИИ-ассистента. */
export async function recentHomework(limit = 60): Promise<{ name: string; date: string; text: string }[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("homework")
    .select("date, text, students(name)")
    .order("date", { ascending: false })
    .limit(limit);
  type Row = { date: string; text: string; students: { name: string } | { name: string }[] | null };
  return ((data ?? []) as Row[]).map((h) => {
    const st = Array.isArray(h.students) ? h.students[0] : h.students;
    return { name: st?.name ?? "—", date: h.date, text: h.text };
  });
}
