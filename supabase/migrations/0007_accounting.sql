-- 0007_accounting.sql — Бухгалтерия (модель «баланс»).
-- Все суммы хранятся в копейках (integer), чтобы не ловить ошибки округления.

-- Дефолтная стоимость занятия.
alter table settings
  add column if not exists default_price_kopecks integer not null default 0;

-- Плательщики за слот: кто и почём платит за это (повторяющееся) занятие.
-- У слота может быть несколько плательщиков, даже если в брони один участник.
create table if not exists lesson_payers (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references slots(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  price_kopecks integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (slot_id, student_id)
);
create index if not exists lesson_payers_slot_idx    on lesson_payers(slot_id);
create index if not exists lesson_payers_student_idx on lesson_payers(student_id);

-- Платежи: кредит на счёт ученика.
create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  amount_kopecks integer not null,
  paid_at        date not null,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists payments_student_idx on payments(student_id);

-- Точка отсчёта биллинга для ученика (с какого числа считаем прошедшие уроки).
create table if not exists student_billing (
  student_id  uuid primary key references students(id) on delete cascade,
  anchor_date date not null default (now() at time zone 'Europe/Moscow')::date,
  created_at  timestamptz not null default now()
);

-- «Урока не было» — не списывать за этот день.
-- student_id = NULL → занятие целиком не состоялось (для всех плательщиков слота);
-- student_id задан → отсутствовал конкретный ученик.
create table if not exists lesson_exceptions (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references slots(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now()
);
create index if not exists lesson_exceptions_slot_idx on lesson_exceptions(slot_id);
