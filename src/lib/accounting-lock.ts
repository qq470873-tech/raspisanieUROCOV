import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { json } from "./api";
import { isTeacher } from "./auth";

/**
 * Второй замок на «Бухгалтерию»: подписанная кука на 30 минут.
 * claim persist — согласилась ли Анастасия «не спрашивать 30 минут»
 * (без него клиент всё равно перепросит пароль при повторном входе).
 */
const ACCT_COOKIE = "acct_unlock";
const ACCT_MAX_AGE = 30 * 60; // 30 минут

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Не задана SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function issueUnlock(persist: boolean): Promise<void> {
  const token = await new SignJWT({ scope: "accounting", persist })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCT_MAX_AGE}s`)
    .sign(secretKey());
  const store = await cookies();
  store.set(ACCT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCT_MAX_AGE,
  });
}

export async function readUnlock(): Promise<{ valid: boolean; persist: boolean }> {
  const store = await cookies();
  const token = store.get(ACCT_COOKIE)?.value;
  if (!token) return { valid: false, persist: false };
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.scope !== "accounting") return { valid: false, persist: false };
    return { valid: true, persist: payload.persist === true };
  } catch {
    return { valid: false, persist: false };
  }
}

/** Гвард для данных бухгалтерии: требует и преподавателя, и валидный замок. */
export async function guardAccounting(): Promise<NextResponse | null> {
  if (!(await isTeacher())) return json({ error: "Не авторизован" }, 401);
  const { valid } = await readUnlock();
  if (!valid) return json({ error: "Бухгалтерия заблокирована" }, 423);
  return null;
}
