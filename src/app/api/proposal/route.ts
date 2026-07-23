import { badRequest, json } from "@/lib/api";
import { proposalResponseSchema } from "@/lib/schemas";
import { respondToProposal } from "@/lib/queries";

/** Публичный эндпоинт: ученик принимает/отклоняет предложенное время. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = proposalResponseSchema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный запрос");

  const result = await respondToProposal(parsed.data.access_token, parsed.data.accept);
  if (!result.ok) return json({ error: "Предложение недоступно" }, 409);
  return json({ ok: true });
}
