-- Фаза 2: правила брони и парные занятия.

-- Раньше слот блокировался любой активной заявкой (pending/confirmed/proposed).
-- Теперь несколько учеников могут проситься на одно время; блокирует только
-- подтверждённая запись — максимум одна на слот.
drop index if exists public.one_active_booking_per_slot;
create unique index if not exists one_confirmed_booking_per_slot
  on public.bookings (slot_id)
  where status = 'confirmed';

-- Парное занятие: второй ученик привязан к заявке.
alter table public.bookings
  add column if not exists partner_student_id uuid references public.students(id) on delete set null;
create index if not exists bookings_partner_idx on public.bookings (partner_student_id);
