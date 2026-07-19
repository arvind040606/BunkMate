# Supabase Database Setup for BunkMate

This guide provides the SQL schema, Row Level Security (RLS) policies, and automated triggers required to set up user management in your Supabase project (`iqmmznvsvabmrzaupgjf`) using the `Bunkmate` table.

---

## 1. SQL Commands to Execute

Go to your **Supabase Dashboard** -> **SQL Editor** -> **New Query**, paste the code below, and click **Run**:

```sql
-- 1. Create the Bunkmate table linked to Supabase Auth users
create table if not exists public."Bunkmate" (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_id text,
  college text,
  course text,
  semester text,
  section text,
  group_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public."Bunkmate" enable row level security;

-- 3. RLS Policies: Allow users full access to ONLY their own profiles
create policy "Users can view their own profile"
  on public."Bunkmate" for select
  using ( auth.uid() = id );

create policy "Users can insert their own profile"
  on public."Bunkmate" for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile"
  on public."Bunkmate" for update
  using ( auth.uid() = id );

-- 4. Automatically create a row in Bunkmate when a new user registers in Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."Bunkmate" (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 5. Attach the trigger to auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 2. Environment Variables Configuration

Open your local `.env` file:

```env
VITE_SUPABASE_URL="https://iqmmznvsvabmrzaupgjf.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_ACTUAL_ANON_KEY"
```

> [!WARNING]
> Do NOT expose your Supabase **Service Role Key** (the secret key) in the client application. Only use the **Anon/Public** key.

---

## 3. What Was Checked/Preserved

- The existing SQLite databases, local synchronization schedules, friend systems, and AI timetables remain completely untouched.
- Supabase is integrated as a standalone authentication/profile management provider.
