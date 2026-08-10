-- Фаза 5: тренажёр английского. Результаты по ученикам — для учителя.
create table if not exists public.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  level      text not null,
  score      int not null,
  total      int not null,
  created_at timestamptz not null default now()
);
create index if not exists quiz_results_student_idx on public.quiz_results (student_id);
alter table public.quiz_results enable row level security;
