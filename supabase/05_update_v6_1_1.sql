-- ============================================================
-- PARSLEY'S FARM v6.1.1 — "Sold by" on sales
-- Run once in the SQL Editor BEFORE uploading the v6.1.1 app files. Safe to run twice.
-- ============================================================
alter table public.sales add column if not exists sold_by text not null default '';
