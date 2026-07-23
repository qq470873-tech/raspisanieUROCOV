import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySessionToken,
} from "./session";

export { SESSION_COOKIE };

/** Проверяет логин/пароль по переменным окружения. */
export function checkCredentials(login: string, password: string): boolean {
  return login.trim() === env.teacherLogin() && password === env.teacherPassword();
}

/** Устанавливает cookie сессии. Вызывать из server action / route handler. */
export async function createSessionCookie(): Promise<void> {
  const token = await signSession();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Удаляет cookie сессии. */
export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Проверяет, авторизован ли текущий запрос как преподаватель. */
export async function isTeacher(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
