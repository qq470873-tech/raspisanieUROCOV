"use client";

/** POST JSON и разбор ответа. Бросает Error с сообщением сервера при ошибке. */
export async function apiPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Ошибка запроса");
  return data as T;
}

export async function apiSend<T = unknown>(url: string, method: string): Promise<T> {
  const res = await fetch(url, { method });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Ошибка запроса");
  return data as T;
}
