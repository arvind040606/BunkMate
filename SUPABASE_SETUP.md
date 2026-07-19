# Supabase Database Setup for BunkMate

This guide provides the SQL queries to set up your existing Supabase database (`iqmmznvsvabmrzaupgjf`) to support user accounts and live cloud synchronization.

---

## 1. Run SQL queries in Supabase Dashboard

Go to your **Supabase Dashboard** -> **SQL Editor** -> **New Query**, paste the code blocks below, and click **Run**:

### STEP A: Alter your existing `users` table
This adds the columns required for password security, salting, and recovery clues to your existing `users` table:

```sql
-- 1. Add missing auth and recovery columns to the users table
alter table public.users add column if not exists "passwordHash" text;
alter table public.users add column if not exists "salt" text;
alter table public.users add column if not exists "securityQuestion" text;
alter table public.users add column if not exists "securityAnswerHash" text;
alter table public.users add column if not exists "securityAnswerSalt" text;
alter table public.users add column if not exists "createdAt" bigint;
```

---

### STEP B: Create the live synchronization tables
This creates all the database tables needed to store your attendance, timetables, subjects, assignments, exams, settings, friends, and deletion trackers:

```sql
-- 2. Create the subjects table
create table if not exists public.subjects (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
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

-- 3. Create the timetable table
create table if not exists public.timetable (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
  "subjectId" text not null references public.subjects(id) on delete cascade,
  "dayOfWeek" integer not null,
  time text not null,
  duration integer not null default 60,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- 4. Create the attendance table
create table if not exists public.attendance (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
  "subjectId" text not null references public.subjects(id) on delete cascade,
  date text not null,
  status text not null,
  timestamp bigint not null,
  "createdAt" text,
  "updatedAt" bigint not null
);

-- 5. Create the assignments table
create table if not exists public.assignments (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
  "subjectId" text references public.subjects(id) on delete cascade,
  title text not null,
  "dueDate" text not null,
  "dueTime" text,
  description text,
  status text not null default 'pending',
  "createdAt" text,
  "updatedAt" bigint not null
);

-- 6. Create the exams table
create table if not exists public.exams (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
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

-- 7. Create the settings table
create table if not exists public.settings (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  "createdAt" text,
  "updatedAt" bigint not null,
  unique("userId", key)
);

-- 8. Create the friends table
create table if not exists public.friends (
  id text primary key,
  "senderId" text not null references public.users(id) on delete cascade,
  "receiverId" text not null references public.users(id) on delete cascade,
  status text not null, -- 'pending' | 'accepted'
  "createdAt" bigint not null
);

-- 9. Create the sync_deletions table
create table if not exists public.sync_deletions (
  id text primary key,
  "userId" text not null references public.users(id) on delete cascade,
  "tableName" text not null,
  "recordId" text not null,
  "deletedAt" bigint not null
);
```

---

### STEP C: Configure access permissions (RLS Bypass)
Run this block to enable Row Level Security (RLS) on all tables and grant read/write policies so the BunkMate clients can synchronize live data:

```sql
-- Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.exams enable row level security;
alter table public.settings enable row level security;
alter table public.friends enable row level security;
alter table public.sync_deletions enable row level security;

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
```

---

## 2. Environment Variables Configuration

Ensure your `.env` file looks like this:

```env
VITE_SUPABASE_URL="https://iqmmznvsvabmrzaupgjf.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_ejPrPSTFInDCOCvobcRsrw_SJNss7bD"
```
