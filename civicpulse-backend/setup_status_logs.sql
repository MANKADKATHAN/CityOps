-- 1. Create the table (if you don't have it yet)
create table if not exists status_logs (
  id uuid default gen_random_uuid() primary key,
  complaint_id uuid references complaints(complaint_id) on delete cascade not null,
  old_status text,
  new_status text not null,
  changed_by uuid references profiles(id), -- The Officer's ID
  changed_at timestamp with time zone default now()
);

-- 2. Enable RLS (Security)
alter table status_logs enable row level security;
create policy "Public can view logs" on status_logs for select using (true);

-- 3. Create the Automation (Trigger)
-- This function runs automatically whenever a complaint is updated
create or replace function public.log_status_change()
returns trigger as $$
begin
  -- Only log if the status actually changed
  if (old.status is distinct from new.status) then
    insert into public.status_logs (complaint_id, old_status, new_status, changed_by)
    values (
      new.complaint_id,
      old.status,
      new.status,
      auth.uid() -- Automatically grabs the ID of the logged-in Officer
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Turn on the Trigger
drop trigger if exists on_complaint_status_change on complaints;
create trigger on_complaint_status_change
  after update on complaints
  for each row execute procedure public.log_status_change();
