-- Фаза 6: групповые занятия до трёх учеников (пара/тройка).
alter table public.bookings
  add column if not exists partner2_student_id uuid references public.students(id) on delete set null;
alter table public.bookings
  add column if not exists student_3 text;
create index if not exists bookings_partner2_idx on public.bookings (partner2_student_id);
