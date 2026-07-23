# Расписание уроков

Простой веб-сервис для преподавателя: выставляешь свободные слоты на неделю →
родители сами записываются по одной универсальной ссылке → ты подтверждаешь.
Модель — **повторяющаяся неделя** (день недели + время, без календарных дат):
подтверждённый слот закрепляется за учеником на весь учебный год.

## Стек

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind 4** + **shadcn/ui**
- **Supabase** (Postgres) — данные
- **Resend** — email-уведомления (опционально)
- Деплой: **Vercel** + Supabase

## Роли и возможности

- **Преподаватель** (вход по логину/паролю): создаёт сетку недели (любые интервалы),
  делится ссылкой, видит все заявки и статусы, может подтвердить / отклонить /
  удалить / освободить / перенести / предложить другое время.
- **Родитель** (без регистрации): по ссылке видит только свободные слоты,
  вводит ФИО ученика (+ второй ученик для парного занятия, комментарий, email),
  отправляет заявку и следит за статусом по личной ссылке.

Групповое занятие = одна заявка с двумя учениками. Двойное бронирование
исключено на уровне БД (частичный уникальный индекс).

---

## Локальный запуск

### 1. Создать проект Supabase
1. https://supabase.com → New project.
2. Project Settings → **API**: скопировать `Project URL`, `anon public` и
   `service_role` ключи.
3. SQL Editor → New query → вставить содержимое
   `supabase/migrations/0001_init.sql` → **Run**.

### 2. Заполнить `.env.local`
Скопировать `.env.example` в `.env.local` и заполнить:

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon public
SUPABASE_SERVICE_ROLE_KEY=...       # service_role (секрет!)
TEACHER_LOGIN=Анастасия
TEACHER_PASSWORD=london
SESSION_SECRET=...                  # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
RESEND_API_KEY=...                  # опционально
TEACHER_EMAIL=...                   # опционально, куда слать заявки
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Запустить
```bash
npm install
npm run dev
```
Открыть http://localhost:3000 → вход в панель по логину/паролю.

> Примечание: dev/build используют webpack (`--webpack`), потому что Turbopack
> падает на кириллице в пути проекта. На Vercel путь ASCII — можно вернуть Turbopack.

---

## Деплой на Vercel

1. Импортировать репозиторий в Vercel.
2. В **Environment Variables** добавить все переменные из `.env.local`,
   заменив `NEXT_PUBLIC_APP_URL` на боевой домен (например `https://xxx.vercel.app`).
3. Deploy.

`RESEND_FROM` должен быть верифицирован в Resend (для теста подойдёт
`onboarding@resend.dev`). Без `RESEND_API_KEY` email просто не отправляется —
остаются внутри-сайтовые статусы.

---

## Структура

```
src/
  app/
    login/                вход преподавателя
    dashboard/            панель: сетка недели + заявки
    book/[token]/         публичная запись (родитель)
    booking/[token]/      статус-страница ученика
    api/                  route handlers (бэкенд)
  lib/                    supabase, auth/session, схемы, домен, email, запросы
supabase/migrations/      SQL-схема
```
