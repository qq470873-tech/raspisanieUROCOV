import { badRequest, guardTeacher, json } from "@/lib/api";
import { getMessages } from "@/lib/chat";

/** Сообщения диалога (?conversation=id). */
export async function GET(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("conversation");
  if (!id) return badRequest("Нет диалога");
  return json({ messages: await getMessages(id) });
}
