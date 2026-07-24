-- ==========================================
-- BunkMate Production Supabase Setup & OTA Migration
-- ==========================================

-- STEP A: Update the existing users table with required columns
alter table public.users add column if not exists "passwordHash" text;
alter table public.users add column if not exists "salt" text;
alter table public.users add column if not exists "securityQuestion" text;
alter table public.users add column if not exists "securityAnswerHash" text;
alter table public.users add column if not exists "securityAnswerSalt" text;
alter table public.users add column if not exists "createdAt" bigint;

-- STEP B: Create the live synchronization tables

-- Create subjects table
create table if not exists public.subjects (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  name text not null,
  code text,
  room text,
  teacher text,
  color text not null,
  "targetPercentage" integer not null default 75,
  "isPinned" integer not null default 0,
  "isArchived" integer not null default 0,
  icon text,
  notes text,
  "initialPresent" integer not null default 0,
  "initialAbsent" integer not null default 0,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- Create timetable table
create table if not exists public.timetable (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  "subjectId" text not null references public.subjects(id) on delete cascade,
  "dayOfWeek" integer not null,
  time text not null,
  duration integer not null default 60,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- Create attendance table
create table if not exists public.attendance (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  "subjectId" text not null references public.subjects(id) on delete cascade,
  date text not null,
  status text not null,
  timestamp bigint not null,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- Create assignments table
create table if not exists public.assignments (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  "subjectId" text references public.subjects(id) on delete cascade,
  title text not null,
  "dueDate" text not null,
  "dueTime" text,
  description text,
  status text not null default 'pending',
  "createdAt" text,
  "updatedAt" bigint not null
);

-- Create exams table
create table if not exists public.exams (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  "subjectId" text references public.subjects(id) on delete cascade,
  title text not null,
  date text not null,
  time text,
  syllabus text,
  room text,
  completed integer not null default 0,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- Create settings table
create table if not exists public.settings (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  "createdAt" text,
  "updatedAt" bigint not null,
  unique("userId", key)
);

-- Create friends table
create table if not exists public.friends (
  id text primary key,
  "senderId" uuid not null references public.users(id) on delete cascade,
  "receiverId" uuid not null references public.users(id) on delete cascade,
  status text not null, -- 'pending' | 'accepted'
  "createdAt" bigint not null
);

-- Create sync_deletions table
create table if not exists public.sync_deletions (
  id text primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  "tableName" text not null,
  "recordId" text not null,
  "deletedAt" bigint not null
);

-- Create latest_updates table (Enhanced for production OTA update management)
create table if not exists public.latest_updates (
  id uuid primary key default gen_random_uuid(),
  latest_version text not null,
  minimum_supported_version text not null,
  google_drive_apk_url text not null,
  release_notes text,
  release_title text default 'BunkMate Latest Release',
  release_date timestamp with time zone default timezone('utc'::text, now()) not null,
  force_update boolean default false not null,
  maintenance_mode boolean default false not null,
  maintenance_message text,
  developer_email text default 'arvindmadaan04@gmail.com'::text,
  app_license text default 'MIT License'::text,
  release_channel text default 'stable'::text,
  release_priority text default 'medium'::text,
  rollout_percentage integer default 100,
  mandatory_after timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Alter latest_updates in case table already exists without newer columns
alter table public.latest_updates add column if not exists release_title text default 'BunkMate Latest Release';
alter table public.latest_updates add column if not exists release_channel text default 'stable';
alter table public.latest_updates add column if not exists release_priority text default 'medium';
alter table public.latest_updates add column if not exists rollout_percentage integer default 100;
alter table public.latest_updates add column if not exists mandatory_after timestamp with time zone;
alter table public.latest_updates add column if not exists maintenance_mode boolean default false;
alter table public.latest_updates add column if not exists maintenance_message text;
alter table public.latest_updates add column if not exists developer_email text default 'arvindmadaan04@gmail.com';
alter table public.latest_updates add column if not exists app_license text default 'MIT License';
alter table public.latest_updates add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Create release_history table for historical version tracking
create table if not exists public.release_history (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  release_notes text,
  release_date timestamp with time zone default timezone('utc'::text, now()) not null,
  apk_url text,
  size text default '15.5 MB',
  critical boolean default false,
  release_channel text default 'stable',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial release info if empty
insert into public.latest_updates (
  latest_version, 
  minimum_supported_version, 
  google_drive_apk_url, 
  release_notes, 
  release_title,
  release_date, 
  force_update, 
  maintenance_mode,
  developer_email,
  app_license,
  release_channel,
  release_priority,
  rollout_percentage
)
select 
  '1.1.1', 
  '1.0.0', 
  'https://drive.google.com', 
  '• Production OTA Update Management System\n• Unlimited semantic version comparison\n• Multi-channel release support (Stable, Beta, Developer)\n• Performance patches and bug fixes', 
  'BunkMate v1.1.1 Production Release',
  now(), 
  false, 
  false,
  'arvindmadaan04@gmail.com',
  'MIT License',
  'stable',
  'medium',
  100
where not exists (select 1 from public.latest_updates);

-- STEP C: Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.exams enable row level security;
alter table public.settings enable row level security;
alter table public.friends enable row level security;
alter table public.sync_deletions enable row level security;
alter table public.latest_updates enable row level security;
alter table public.release_history enable row level security;

-- Drop existing policies if any to prevent duplicates
drop policy if exists "Select policy for users" on public.users;
drop policy if exists "Insert policy for users" on public.users;
drop policy if exists "Update policy for users" on public.users;
drop policy if exists "Delete policy for users" on public.users;

drop policy if exists "Select policy for subjects" on public.subjects;
drop policy if exists "Insert policy for subjects" on public.subjects;
drop policy if exists "Update policy for subjects" on public.subjects;
drop policy if exists "Delete policy for subjects" on public.subjects;

drop policy if exists "Select policy for timetable" on public.timetable;
drop policy if exists "Insert policy for timetable" on public.timetable;
drop policy if exists "Update policy for timetable" on public.timetable;
drop policy if exists "Delete policy for timetable" on public.timetable;

drop policy if exists "Select policy for attendance" on public.attendance;
drop policy if exists "Insert policy for attendance" on public.attendance;
drop policy if exists "Update policy for attendance" on public.attendance;
drop policy if exists "Delete policy for attendance" on public.attendance;

drop policy if exists "Select policy for assignments" on public.assignments;
drop policy if exists "Insert policy for assignments" on public.assignments;
drop policy if exists "Update policy for assignments" on public.assignments;
drop policy if exists "Delete policy for assignments" on public.assignments;

drop policy if exists "Select policy for exams" on public.exams;
drop policy if exists "Insert policy for exams" on public.exams;
drop policy if exists "Update policy for exams" on public.exams;
drop policy if exists "Delete policy for exams" on public.exams;

drop policy if exists "Select policy for settings" on public.settings;
drop policy if exists "Insert policy for settings" on public.settings;
drop policy if exists "Update policy for settings" on public.settings;
drop policy if exists "Delete policy for settings" on public.settings;

drop policy if exists "Select policy for friends" on public.friends;
drop policy if exists "Insert policy for friends" on public.friends;
drop policy if exists "Update policy for friends" on public.friends;
drop policy if exists "Delete policy for friends" on public.friends;

drop policy if exists "Select policy for sync_deletions" on public.sync_deletions;
drop policy if exists "Insert policy for sync_deletions" on public.sync_deletions;
drop policy if exists "Update policy for sync_deletions" on public.sync_deletions;
drop policy if exists "Delete policy for sync_deletions" on public.sync_deletions;

drop policy if exists "Allow public read access to latest updates" on public.latest_updates;
drop policy if exists "Allow developer insert/update access to latest updates" on public.latest_updates;

drop policy if exists "Allow public read access on release_history" on public.release_history;
drop policy if exists "Allow developer insert/update access to release_history" on public.release_history;

-- Create full-access RLS policies
create policy "Select policy for users" on public.users for select using (true);
create policy "Insert policy for users" on public.users for insert with check (true);
create policy "Update policy for users" on public.users for update using (true);
create policy "Delete policy for users" on public.users for delete using (true);

create policy "Select policy for subjects" on public.subjects for select using (true);
create policy "Insert policy for subjects" on public.subjects for insert with check (true);
create policy "Update policy for subjects" on public.subjects for update using (true);
create policy "Delete policy for subjects" on public.subjects for delete using (true);

create policy "Select policy for timetable" on public.timetable for select using (true);
create policy "Insert policy for timetable" on public.timetable for insert with check (true);
create policy "Update policy for timetable" on public.timetable for update using (true);
create policy "Delete policy for timetable" on public.timetable for delete using (true);

create policy "Select policy for attendance" on public.attendance for select using (true);
create policy "Insert policy for attendance" on public.attendance for insert with check (true);
create policy "Update policy for attendance" on public.attendance for update using (true);
create policy "Delete policy for attendance" on public.attendance for delete using (true);

create policy "Select policy for assignments" on public.assignments for select using (true);
create policy "Insert policy for assignments" on public.assignments for insert with check (true);
create policy "Update policy for assignments" on public.assignments for update using (true);
create policy "Delete policy for assignments" on public.assignments for delete using (true);

create policy "Select policy for exams" on public.exams for select using (true);
create policy "Insert policy for exams" on public.exams for insert with check (true);
create policy "Update policy for exams" on public.exams for update using (true);
create policy "Delete policy for exams" on public.exams for delete using (true);

create policy "Select policy for settings" on public.settings for select using (true);
create policy "Insert policy for settings" on public.settings for insert with check (true);
create policy "Update policy for settings" on public.settings for update using (true);
create policy "Delete policy for settings" on public.settings for delete using (true);

create policy "Select policy for friends" on public.friends for select using (true);
create policy "Insert policy for friends" on public.friends for insert with check (true);
create policy "Update policy for friends" on public.friends for update using (true);
create policy "Delete policy for friends" on public.friends for delete using (true);

create policy "Select policy for sync_deletions" on public.sync_deletions for select using (true);
create policy "Insert policy for sync_deletions" on public.sync_deletions for insert with check (true);
create policy "Update policy for sync_deletions" on public.sync_deletions for update using (true);
create policy "Delete policy for sync_deletions" on public.sync_deletions for delete using (true);

create policy "Allow public read access to latest updates" on public.latest_updates for select using (true);
create policy "Allow developer insert/update access to latest updates" on public.latest_updates for all using (true);

create policy "Allow public read access on release_history" on public.release_history for select using (true);
create policy "Allow developer insert/update access to release_history" on public.release_history for all using (true);
