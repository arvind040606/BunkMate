# Supabase Database Setup for BunkMate

This guide provides the SQL schema, Row Level Security (RLS) policies, and automated triggers required to set up user management and synchronization tables in your Supabase project (`iqmmznvsvabmrzaupgjf`).

---

## 1. SQL Commands to Execute

Go to your **Supabase Dashboard** -> **SQL Editor** -> **New Query**, paste the code below, and click **Run**:

```sql
-- 1. Create the users table in Supabase
create table if not exists public.users (
  id text primary key,
  username text unique not null,
  avatar_id text,
  display_name text,
  college text,
  course text,
  semester text,
  section text,
  group_name text,
  createdAt bigint,
  passwordHash text,
  salt text,
  securityQuestion text,
  securityAnswerHash text,
  securityAnswerSalt text
);

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

-- 10. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.exams enable row level security;
alter table public.settings enable row level security;
alter table public.friends enable row level security;
alter table public.sync_deletions enable row level security;

-- 11. Create Simple Bypass RLS Policies (Allow Authenticated/Anon clients to run operations)
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

Open your local `.env` file:

```env
VITE_SUPABASE_URL="https://iqmmznvsvabmrzaupgjf.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_ejPrPSTFInDCOCvobcRsrw_SJNss7bD"
```

> [!WARNING]
> Do NOT expose your Supabase **Service Role Key** (the secret key) in the client application. Only use the **Anon/Public** key.

---

## 3. System Highlights

- Direct integration between frontend and backend via Vercel and localhost using standard Supabase JS client structures.
- Offline-first cache ensures seamless local performance when network or server is offline.
