-- Расписание уроков — начальная схема
-- Модель: повторяющаяся неделя (день недели + время), без календарных дат.
-- Один преподаватель. Родители анонимны, все операции идут через серверный код
-- с service-role ключом, поэтому RLS включён и закрыт для anon/authenticated.

-- ── Настройки (одна строка): универсальный токен ссылки для родителей ──────────
create table if not exists public.settings (
  id            int primary key default 1,
  booking_token text not null,
  constraint settings_singleton check (id = 1)
);

-- ── Слоты сетки недели ─────────────────────────────────────────────────────────
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 1 and 7), -- 1=Пн ... 7=Вс
  start_time time not null,
  end_time   time not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint slot_time_order check (end_time > start_time)
);

create index if not exists slots_weekday_idx on public.slots (weekday, start_time);

-- ── Статусы заявок ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum
      ('pending', 'confirmed', 'rejected', 'proposed', 'cancelled');
  end if;
end $$;

-- ── Заявки ─────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.slots(id) on delete cascade,
  student_1    text not null,               -- ФИО ученика
  student_2    text,                         -- второй ученик (групповое занятие)
  comment      text,
  email        text,                         -- опционально, для уведомлений
  status       public.booking_status not null default 'pending',
  access_token text not null unique,         -- секрет для статус-страницы ученика
  teacher_seen boolean not null default false,
  student_seen boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists bookings_slot_idx on public.bookings (slot_id);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- Защита от двойного бронирования: на один слот максимум одна активная заявка.
create unique index if not exists one_active_booking_per_slot
  on public.bookings (slot_id)
  where status in ('pending', 'confirmed', 'proposed');

-- Автообновление updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ── RLS: закрыто для публичных ролей; service-role (сервер) обходит RLS ─────────
alter table public.settings enable row level security;
alter table public.slots    enable row level security;
alter table public.bookings enable row level security;
-- Политик нет намеренно: anon/authenticated не имеют прямого доступа.
