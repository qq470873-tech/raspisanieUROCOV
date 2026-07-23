import "server-only";
import { Resend } from "resend";
import { env } from "./env";
import { formatRange, weekdayLong, type Booking, type Slot } from "./domain";

function client(): Resend | null {
  const key = env.resendApiKey();
  return key ? new Resend(key) : null;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = client();
  if (!resend || !to) return; // email не настроен или адреса нет — тихо пропускаем
  try {
    await resend.emails.send({ from: env.resendFrom(), to, subject, html });
  } catch (e) {
    console.error("Ошибка отправки email:", e);
  }
}

function studentNames(b: Pick<Booking, "student_1" | "student_2">): string {
  return b.student_2 ? `${b.student_1} + ${b.student_2}` : b.student_1;
}

function when(slot: Slot): string {
  return `${weekdayLong(slot.weekday)}, ${formatRange(slot.start_time, slot.end_time)}`;
}

/** Преподавателю — о новой заявке. */
export async function notifyTeacherNewBooking(booking: Booking, slot: Slot): Promise<void> {
  const to = env.teacherEmail();
  if (!to) return;
  const comment = booking.comment ? `<p>Комментарий: ${escapeHtml(booking.comment)}</p>` : "";
  await send(
    to,
    `Новая заявка: ${when(slot)}`,
    `<p><b>${escapeHtml(studentNames(booking))}</b> хочет забронировать:</p>
     <p><b>${when(slot)}</b></p>
     ${comment}
     <p><a href="${env.appUrl()}/dashboard">Открыть панель</a></p>`,
  );
}

/** Ученику — решение по заявке (если оставил email). */
export async function notifyStudentDecision(
  booking: Booking,
  slot: Slot,
  decision: "confirmed" | "rejected",
): Promise<void> {
  if (!booking.email) return;
  const text =
    decision === "confirmed"
      ? `Ваша запись на <b>${when(slot)}</b> подтверждена ✅`
      : `К сожалению, запись на <b>${when(slot)}</b> отклонена ❌`;
  await send(booking.email, `Запись: ${when(slot)}`, `<p>${text}</p>`);
}

/** Ученику — предложение другого времени. */
export async function notifyStudentProposal(booking: Booking, slot: Slot): Promise<void> {
  if (!booking.email) return;
  const link = `${env.appUrl()}/booking/${booking.access_token}`;
  await send(
    booking.email,
    `Вам предложили другое время`,
    `<p>Вам предложили новое время: <b>${when(slot)}</b></p>
     <p><a href="${link}">Принять или отклонить</a></p>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
