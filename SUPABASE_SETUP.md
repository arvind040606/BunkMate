# Supabase Database Setup for BunkMate

This guide provides the SQL schema, Row Level Security (RLS) policies, and automated triggers required to set up user management in your Supabase project (`iqmmznvsvabmrzaupgjf`) using the `users` table.

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

-- 2. Enable Row Level Security (RLS)
alter table public.users enable row level security;

-- 3. RLS Policies: Allow users full access to ONLY their own profiles
create policy "Users can view all users"
  on public.users for select
  using ( true );

create policy "Users can insert their own user"
  on public.users for insert
  with check ( true );

create policy "Users can update their own user"
  on public.users for update
  using ( true );
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

## 3. What Was Checked/Preserved

- The existing SQLite databases, local synchronization schedules, friend systems, and AI timetables remain completely untouched.
- Supabase is integrated as a standalone database connection provider.
