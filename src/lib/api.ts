import "server-only";
import { NextResponse } from "next/server";
import { isTeacher } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

/** Возвращает Response с 401, если запрос не от преподавателя, иначе null. */
export async function guardTeacher(): Promise<NextResponse | null> {
  if (!(await isTeacher())) return json({ error: "Не авторизован" }, 401);
  return null;
}
