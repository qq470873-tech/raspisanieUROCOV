-- 0008_homework.sql — Домашние задания: что задано ученику на конкретную дату.

create table if not exists homework (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date       date not null,
  text       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists homework_student_idx on homework(student_id);
