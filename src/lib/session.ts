/**
 * Edge-safe работа с JWT-сессией (без server-only / next/headers).
 * Используется и в middleware, и в серверном коде.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "teacher_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Не задана SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signSession(): Promise<string> {
  return new SignJWT({ role: "teacher" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "teacher";
  } catch {
    return false;
  }
}
