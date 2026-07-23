/**
 * Централизованный доступ к переменным окружения.
 * Серверные секреты читаются только на сервере.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Проверь .env.local`);
  }
  return value;
}

export const env = {
  // Supabase (server)
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseServiceKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),

  // Auth
  teacherLogin: () => required("TEACHER_LOGIN", process.env.TEACHER_LOGIN),
  teacherPassword: () => required("TEACHER_PASSWORD", process.env.TEACHER_PASSWORD),
  sessionSecret: () => required("SESSION_SECRET", process.env.SESSION_SECRET),

  // Email (опционально)
  resendApiKey: () => process.env.RESEND_API_KEY || "",
  resendFrom: () => process.env.RESEND_FROM || "Расписание <onboarding@resend.dev>",
  teacherEmail: () => process.env.TEACHER_EMAIL || "",

  // App
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const;
