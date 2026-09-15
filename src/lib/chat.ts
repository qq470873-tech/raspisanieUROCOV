import "server-only";
import { supabaseAdmin } from "./supabase";

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
}

export interface ChatDBMessage {
  id: string;
  role: "user" | "model";
  text: string;
  created_at: string;
}

/** Список диалогов: закреплённые сверху, затем по свежести. */
export async function listConversations(): Promise<Conversation[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("chat_conversations")
    .select("id, title, pinned, updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  return (data ?? []) as Conversation[];
}

export async function createConversation(title = "Новый чат"): Promise<Conversation> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("chat_conversations")
    .insert({ title })
    .select("id, title, pinned, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("chat_conversations").update({ title: title.trim() || "Без названия" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("chat_conversations").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("chat_conversations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getMessages(conversationId: string): Promise<ChatDBMessage[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("chat_messages")
    .select("id, role, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ChatDBMessage[];
}

export async function addMessage(
  conversationId: string,
  role: "user" | "model",
  text: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("chat_messages")
    .insert({ conversation_id: conversationId, role, text });
  if (error) throw new Error(error.message);
  await db
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/** Проставляет заголовок диалога по первому сообщению, если он ещё дефолтный. */
export async function autoTitle(conversationId: string, firstUserText: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("chat_conversations")
    .select("title")
    .eq("id", conversationId)
    .maybeSingle();
  const cur = (data as { title: string } | null)?.title;
  if (cur && cur !== "Новый чат") return null;
  const title = firstUserText.trim().slice(0, 40) || "Новый чат";
  await db.from("chat_conversations").update({ title }).eq("id", conversationId);
  return title;
}
