import { z } from "zod";

const timeHHMM = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");

export const loginSchema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

/** Один слот при создании/редактировании сетки. */
export const slotInputSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    start_time: timeHHMM,
    end_time: timeHHMM,
  })
  .refine((s) => s.end_time > s.start_time, {
    message: "Конец должен быть позже начала",
    path: ["end_time"],
  });

export const createSlotsSchema = z.object({
  slots: z.array(slotInputSchema).min(1, "Добавьте хотя бы один слот"),
});

/** Заявка от родителя. student_1 = ФИО ученика. */
export const bookingInputSchema = z.object({
  token: z.string().min(1),
  slot_id: z.string().uuid(),
  student_1: z.string().trim().min(2, "Укажите имя и фамилию").max(120),
  student_2: z.string().trim().max(120).optional().or(z.literal("")),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
  email: z.string().trim().email("Некорректный email").optional().or(z.literal("")),
});

/** Действия преподавателя над заявкой. */
export const bookingActionSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(["confirm", "reject", "delete", "cancel"]),
});

/** Перенос/предложение другого слота. */
export const bookingMoveSchema = z.object({
  booking_id: z.string().uuid(),
  target_slot_id: z.string().uuid(),
  mode: z.enum(["move", "propose"]), // move — сразу перенести; propose — предложить ученику
});

/** Ответ ученика на предложение. */
export const proposalResponseSchema = z.object({
  access_token: z.string().min(1),
  accept: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SlotInput = z.infer<typeof slotInputSchema>;
export type BookingInput = z.infer<typeof bookingInputSchema>;
