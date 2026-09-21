-- 0010_accounting_schedule.sql — Независимое расписание бухгалтерии.
--
-- Раньше денежное расписание выводилось из основного (slots + подтверждённые
-- брони + lesson_payers). Теперь у бухгалтерии своя сетка: мама сама добавляет
-- и удаляет учеников со своими временами и ценами, не трогая основное расписание.

-- Своя недельная сетка бухгалтерии (день недели + время).
create table if not exists accounting_slots (
  id         uuid primary key default gen_random_uuid(),
  weekday    integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time   time not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists accounting_slots_weekday_idx on accounting_slots(weekday);

-- Плательщики на слоте бухгалтерии: кто и почём. Групповые занятия = несколько строк.
create table if not exists accounting_payers (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references accounting_slots(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  price_kopecks integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (slot_id, student_id)
);
create index if not exists accounting_payers_slot_idx    on accounting_payers(slot_id);
create index if not exists accounting_payers_student_idx on accounting_payers(student_id);

-- ── Разовый перенос текущего расписания в бухгалтерию ────────────────────────────
-- Копируем активные слоты С ТЕМИ ЖЕ id, чтобы уже проставленные «урока не было»
-- (lesson_exceptions.slot_id) и цены сошлись без пересчёта.
insert into accounting_slots (id, weekday, start_time, end_time, is_active)
select id, weekday, start_time, end_time, is_active
from slots
where is_active
on conflict (id) do nothing;

-- Плательщики: участники подтверждённых броней + доп. плательщики из lesson_payers,
-- цена = переопределение из lesson_payers, иначе цена по умолчанию.
insert into accounting_payers (slot_id, student_id, price_kopecks)
select p.slot_id,
       p.student_id,
       coalesce(lp.price_kopecks, (select default_price_kopecks from settings where id = 1), 0)
from (
  select b.slot_id,
         unnest(array_remove(array[b.student_id, b.partner_student_id, b.partner2_student_id], null)) as student_id
  from bookings b
  where b.status = 'confirmed'
  union
  select lp2.slot_id, lp2.student_id
  from lesson_payers lp2
) p
left join lesson_payers lp on lp.slot_id = p.slot_id and lp.student_id = p.student_id
where p.slot_id in (select id from accounting_slots)
on conflict (slot_id, student_id) do nothing;

-- «Урока не было» теперь привязано к слотам бухгалтерии.
delete from lesson_exceptions where slot_id not in (select id from accounting_slots);
alter table lesson_exceptions drop constraint if exists lesson_exceptions_slot_id_fkey;
alter table lesson_exceptions
  add constraint lesson_exceptions_slot_id_fkey
  foreign key (slot_id) references accounting_slots(id) on delete cascade;
