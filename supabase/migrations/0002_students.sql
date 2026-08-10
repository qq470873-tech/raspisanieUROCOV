-- Фаза 1: личность ученика.
-- Ученик узнаётся по имени, привязан к «домохозяйству» (household) — так группируются
-- братья/сёстры одного родителя. Личность хранится в cookie = household_id.

create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  household_id uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

-- Имя — ключ узнавания (без учёта регистра/крайних пробелов на уровне индекса).
create unique index if not exists students_name_key on public.students (lower(btrim(name)));
create index if not exists students_household_idx on public.students (household_id);

alter table public.students enable row level security;
-- Политик нет: доступ только через серверный service-role.

-- Заявка ссылается на ученика.
alter table public.bookings
  add column if not exists student_id uuid references public.students(id) on delete set null;
create index if not exists bookings_student_idx on public.bookings (student_id);

-- Бэкфилл: из существующих заявок создаём учеников и связываем.
do $$
declare
  b record;
  sid uuid;
begin
  for b in
    select id, student_1 from public.bookings
    where student_id is null and student_1 is not null and btrim(student_1) <> ''
  loop
    select id into sid from public.students where lower(btrim(name)) = lower(btrim(b.student_1)) limit 1;
    if sid is null then
      insert into public.students(name) values (btrim(b.student_1)) returning id into sid;
    end if;
    update public.bookings set student_id = sid where id = b.id;
  end loop;
end $$;
