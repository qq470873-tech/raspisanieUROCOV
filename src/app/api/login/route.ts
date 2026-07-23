import { badRequest, json } from "@/lib/api";
import { checkCredentials, createSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Проверьте введённые данные");

  if (!checkCredentials(parsed.data.login, parsed.data.password)) {
    return json({ error: "Неверный логин или пароль" }, 401);
  }

  await createSessionCookie();
  return json({ ok: true });
}
