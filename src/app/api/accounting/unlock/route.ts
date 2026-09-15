import { badRequest, guardTeacher, json } from "@/lib/api";
import { env } from "@/lib/env";
import { issueUnlock, readUnlock } from "@/lib/accounting-lock";

/** Статус замка (для авто-разблокировки при действующей 30-мин куке). */
export async function GET() {
  const denied = await guardTeacher();
  if (denied) return denied;
  const { valid, persist } = await readUnlock();
  return json({ unlocked: valid, persist });
}

/** Проверка пароля бухгалтерии. remember=true → «не спрашивать 30 минут». */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown; remember?: unknown }
    | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const remember = body?.remember === true;

  if (password !== env.accountingPassword()) {
    return badRequest("Неверный пароль");
  }
  await issueUnlock(remember);
  return json({ ok: true, persist: remember });
}
