-- DATA CLEANUP
-- 1. Drop the strict check constraint on 'priority' so you can save "High", "Medium", "low", etc.
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_priority_check;

-- 2. (Optional) If you have a constraint on issue_type, you can drop that too to be safe.
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_issue_type_check;

-- 3. (Optional) Ensure RLS is disabled or allows inserts (if you haven't done this already)
ALTER TABLE complaints DISABLE ROW LEVEL SECURITY;
