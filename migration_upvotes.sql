-- Run this in your Supabase SQL Editor to add the upvotes column
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
