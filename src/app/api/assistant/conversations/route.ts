import { badRequest, guardTeacher, json } from "@/lib/api";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  setPinned,
} from "@/lib/chat";

/** Список диалогов Люси. */
export async function GET() {
  const denied = await guardTeacher();
  if (denied) return denied;
  return json({ conversations: await listConversations() });
}

/** create / rename / pin / delete. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const b = (await request.json().catch(() => null)) as
    | { action?: string; id?: string; title?: string; pinned?: boolean }
    | null;

  try {
    switch (b?.action) {
      case "create":
        return json({ conversation: await createConversation() });
      case "rename":
        if (!b.id || !b.title?.trim()) return badRequest("Нет данных");
        await renameConversation(b.id, b.title);
        return json({ ok: true });
      case "pin":
        if (!b.id) return badRequest("Нет диалога");
        await setPinned(b.id, b.pinned === true);
        return json({ ok: true });
      case "delete":
        if (!b.id) return badRequest("Нет диалога");
        await deleteConversation(b.id);
        return json({ ok: true });
      default:
        return badRequest("Неизвестное действие");
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
