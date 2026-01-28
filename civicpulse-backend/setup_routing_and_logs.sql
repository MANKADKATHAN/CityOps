-- 1. Add Department to Profiles (to know which officer handles what)
alter table profiles 
add column if not exists department text;

-- 2. Create Status Logs Table (Audit Trail)
create table if not exists status_logs (
  id uuid default gen_random_uuid() primary key,
  complaint_id uuid references complaints(complaint_id) on delete cascade not null,
  old_status text,
  new_status text,
  changed_by uuid references profiles(id),
  changed_at timestamp with time zone default now()
);

-- Enable access to status logs
alter table status_logs enable row level security;
create policy "Public view logs" on status_logs for select using (true);
create policy "Officers insert logs" on status_logs for insert with check (auth.uid() = changed_by);

-- 3. (Optional) Auto-assign department for testing
-- Update your own user to be "sanitation" for testing!
-- update profiles set department = 'Sanitation Dept.' where role = 'officer';
