import { badRequest, json } from "@/lib/api";
import { guardAccounting } from "@/lib/accounting-lock";
import { getStudentLedger } from "@/lib/accounting";

/** История изменений баланса ученика (?student=id): пополнения и списания. */
export async function GET(request: Request) {
  const denied = await guardAccounting();
  if (denied) return denied;
  const studentId = new URL(request.url).searchParams.get("student");
  if (!studentId) return badRequest("Не выбран ученик");
  return json({ entries: await getStudentLedger(studentId) });
}
