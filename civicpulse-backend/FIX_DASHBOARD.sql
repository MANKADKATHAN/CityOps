-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Add the user_id column to link complaints to users
alter table public.complaints 
add column if not exists user_id uuid references auth.users(id);

-- 2. Enable Row Level Security (RLS) to secure the data
alter table public.complaints enable row level security;

-- 3. ALLOW VIEW: Users can only see their OWN complaints
-- This ensures 'My Dashboard' works but you can't see others' data
create policy "Users can view own complaints"
on public.complaints
for select
using (auth.uid() = user_id);

-- 4. ALLOW INSERT: Allow anyone (server/app) to create complaints
-- (For this demo, we verify input in backend, so we allow DB insertion)
create policy "Enable insert for everyone"
on public.complaints
for insert
with check (true);

-- 5. (Optional) Allow reading image uploads from Evidence bucket
-- If you haven't set up storage policies yet
insert into storage.buckets (id, name, public) 
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

create policy "Give public access to evidence images"
on storage.objects for select
using ( bucket_id = 'evidence' );

create policy "Allow uploads to evidence bucket"
on storage.objects for insert
with check ( bucket_id = 'evidence' );
