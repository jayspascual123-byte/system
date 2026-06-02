-- ==========================================================
-- Phase 1: Custom Enums & Types
-- ==========================================================
create type user_role as enum ('patient', 'doctor', 'admin');
create type appointment_status as enum ('Pending', 'Confirmed', 'Cancelled', 'Rescheduled');

-- ==========================================================
-- Phase 2: Database Schema Tables
-- ==========================================================

-- Table 1: User Profiles linked to Supabase Native Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text not null,
  role user_role not null default 'patient'::user_role,
  specialization text,
  contact text,
  email text
);

-- Table 2: Doctor Availability Schedule
create table public.doctor_schedule (
  id bigint generated always as identity primary key,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  available_date date not null,
  available_time time not null,
  is_available boolean default true not null,
  constraint unique_doctor_slot unique (doctor_id, available_date, available_time)
);

-- Table 3: System Appointments Ledger
create table public.appointments (
  id bigint generated always as identity primary key,
  patient_id uuid references public.profiles(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  schedule_id bigint references public.doctor_schedule(id) on delete cascade not null,
  status appointment_status default 'Pending'::appointment_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table 4: Patient Electronic Health Records (EHR)
create table public.patient_records (
  id bigint generated always as identity primary key,
  patient_id uuid references public.profiles(id) on delete cascade unique not null,
  medical_history text,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================================
-- Phase 3: Row Level Security (RLS) Policies
-- ==========================================================

-- 1. Profiles Table Policies
alter table public.profiles enable row level security;

create policy "Allow read access to profiles for authenticated users" 
  on public.profiles for select to authenticated using (true);

create policy "Allow users to update their own profile details" 
  on public.profiles for update to authenticated 
  using (auth.uid() = id) with check (auth.uid() = id);

-- 2. Doctor Schedule Table Policies
alter table public.doctor_schedule enable row level security;

create policy "Allow read access to schedule slots for authenticated users" 
  on public.doctor_schedule for select to authenticated using (true);

create policy "Allow doctors to publish slots under their own ID" 
  on public.doctor_schedule for insert to authenticated 
  with check (auth.uid() = doctor_id);

create policy "Allow doctors to delete their own slots" 
  on public.doctor_schedule for delete to authenticated 
  using (auth.uid() = doctor_id);

create policy "Allow schedule updates for slot booking and cancellation" 
  on public.doctor_schedule for update to authenticated using (true);

-- 3. Appointments Table Policies
alter table public.appointments enable row level security;

create policy "Allow relevant parties or admins to view appointments" 
  on public.appointments for select to authenticated 
  using (
    patient_id = auth.uid() or 
    doctor_id = auth.uid() or 
    (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  );

create policy "Allow patient scheduling request creation" 
  on public.appointments for insert to authenticated 
  with check (
    patient_id = auth.uid() or 
    (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  );

create policy "Allow status overrides by patients, doctors, or admins" 
  on public.appointments for update to authenticated 
  using (
    patient_id = auth.uid() or 
    doctor_id = auth.uid() or 
    (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  );

create policy "Allow deletion of appointments for admin override only" 
  on public.appointments for delete to authenticated 
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 4. Patient EHR Records Policies
alter table public.patient_records enable row level security;

create policy "Allow patients to read their own health history record" 
  on public.patient_records for select to authenticated 
  using (
    patient_id = auth.uid() or 
    (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  );

create policy "Allow full health history records writing for admins only" 
  on public.patient_records for all to authenticated 
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ==========================================================
-- Phase 4: Auth Handlers and Triggers
-- ==========================================================

-- Automated trigger to map authentication users to profiles table
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, role, email)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'username', new.email), 
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'), 
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'patient'::user_role),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================================
-- Phase 5: Enable Realtime publications on generated tables
-- ==========================================================
alter publication supabase_realtime add table appointments;
alter publication supabase_realtime add table doctor_schedule;
