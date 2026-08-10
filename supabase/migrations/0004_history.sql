-- Фаза 3: журнал событий (история заявок).
-- Денормализуем имя и время в событие, чтобы история пережила удаление заявки/слота.

create table if not exists public.booking_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  booking_id   uuid,
  student_name text not null,
  partner_name text,
  weekday      smallint,
  start_time   time,
  end_time     time,
  action       text not null,       -- requested/confirmed/rejected/auto_rejected/cancelled/moved/proposed/paired/accepted/declined/deleted
  by_role      text not null default 'teacher'  -- 'student' | 'teacher'
);

create index if not exists booking_events_created_idx on public.booking_events (created_at desc);
alter table public.booking_events enable row level security;
