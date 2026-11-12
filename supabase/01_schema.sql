-- ============================================================
-- PARSLEY'S FARM v6 — Database setup
-- Run this once in a NEW Supabase project: SQL Editor → New query → paste → Run.
-- Then run 02_seed.sql, then 03_first_admin.sql.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- people (who can sign in, and what they can do) ----------
-- id is the person's email address in lower case.
-- perms: field, edit_beds, sales, expenses, money, people
create table if not exists public.people (
  id          text primary key,
  name        text not null,
  role        text not null default 'Farm hand',
  perms       text[] not null default '{field}',
  note        text not null default '',
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where id = public.my_email() and active)
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where id = public.my_email() and active and p = any(perms))
$$;

-- ---------- farm layout and beds ----------
create table if not exists public.crops (
  id          text primary key,
  name        text not null,
  name_sw     text not null default '',
  color       text not null default '#888888',
  kind        text not null default 'main',          -- main | other | fixed
  count_from  text not null default 'Planting',      -- Planting | Transplant
  stages      jsonb not null default '[]',           -- [["Vegetative",0],["Flowering",30]]
  feeds       jsonb not null default '[]',           -- [["DAP",14],["CAN",21]]
  to_remove   boolean not null default false,
  sort        int not null default 0,
  archived    boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text default public.my_email()
);

create table if not exists public.blocks (
  id          text primary key,                      -- e.g. joshua-A, joel-GH
  farm        text not null,                         -- joshua | joel
  code        text not null,                         -- A, B, C, GH, D, oldC
  label       text not null,
  kind        text not null default 'block',         -- block | greenhouse | defunct
  was         text not null default '',
  top_note    text not null default '',
  bottom_note text not null default '',
  subs        jsonb not null default '[]',           -- hydrant sections: [[1,10],[11,20]]
  extras      jsonb not null default '[]',           -- beds not on a hydrant
  short_beds  jsonb not null default '[]',
  gh_range    jsonb,                                 -- beds now under the greenhouse
  sub_notes   jsonb not null default '{}',
  sort        int not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  text default public.my_email()
);

create table if not exists public.beds (
  id          text primary key,                      -- farm|block|number, e.g. joshua|B|5
  farm        text not null,
  block       text not null,
  num         int not null,
  crop        text not null default 'empty',
  plant_date  date,
  approx      boolean not null default false,
  note        text not null default '',
  drip        int,
  poor        boolean not null default false,
  needs_check boolean not null default false,
  seedbed     boolean not null default false,
  feeds_done  text[] not null default '{}',
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  text default public.my_email()
);

-- Everything done on the farm: planting, spraying, feeding, harvest, other work, edits.
create table if not exists public.records (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  type        text not null,                         -- plant | spray | harvest | work | edit
  title       text not null,
  details     text not null default '',
  where_text  text not null default '',
  targets     text[] not null default '{}',          -- bed ids
  done_by     text not null default '',
  photo_url   text not null default '',
  data        jsonb not null default '{}',           -- products, rates, pumps, lot
  deleted     boolean not null default false,
  created_by  text default public.my_email(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              text not null default '',
  active_ingredient text not null default '',
  phi_days          int,                             -- days to wait before harvest
  deleted           boolean not null default false,
  updated_at        timestamptz not null default now()
);

-- ---------- sales ----------
create sequence if not exists public.receipt_seq;

create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  receipt_no  text unique,
  date        date not null default current_date,
  crop        text not null,
  qty         numeric not null,
  unit        text not null default 'kg',
  price       numeric not null,
  total       numeric not null,
  buyer       text not null default '',
  pay_method  text not null default 'Cash',
  farm        text not null default '',
  lot         text not null default '',
  payments    jsonb not null default '[]',           -- [{"date":"2026-11-12","amt":500,"how":"M-Pesa"}]
  deleted     boolean not null default false,
  created_by  text default public.my_email(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.set_receipt_no() returns trigger
language plpgsql as $$
begin
  if new.receipt_no is null or new.receipt_no = '' then
    new.receipt_no := 'PF-' || lpad(nextval('public.receipt_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create table if not exists public.store_items (
  id          text primary key,                      -- crop|unit
  crop        text not null,
  unit        text not null,
  qty         numeric not null default 0,
  lot         text not null default '',
  updated_at  timestamptz not null default now()
);

-- ---------- expenses and bills ----------
create table if not exists public.bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Other',
  amount      numeric not null default 0,
  active      boolean not null default true,
  note        text not null default '',
  sort        int not null default 0,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  category    text not null,
  lines       jsonb not null default '[]',           -- [{"item":"Tihan 1 L","amt":3200}]
  total       numeric not null default 0,
  supplier    text not null default '',
  paid_by     text not null default '',
  method      text not null default '',
  bill_id     uuid,                                  -- set when this pays a regular bill
  bill_month  text,                                  -- e.g. 2026-11
  deleted     boolean not null default false,
  created_by  text default public.my_email(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  key   text primary key,
  value text not null
);

-- ---------- triggers ----------
do $$
declare t text;
begin
  foreach t in array array['people','crops','blocks','beds','records','products','sales','store_items','bills','expenses'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

drop trigger if exists receipt_no on public.sales;
create trigger receipt_no before insert on public.sales for each row execute function public.set_receipt_no();

create index if not exists records_updated_idx on public.records (updated_at);
create index if not exists beds_updated_idx on public.beds (updated_at);
create index if not exists sales_updated_idx on public.sales (updated_at);
create index if not exists expenses_updated_idx on public.expenses (updated_at);

-- ---------- expenses PIN ----------
create or replace function public.check_pin(p_pin text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare h text;
begin
  if not (public.has_perm('money') or public.has_perm('expenses')) then return false; end if;
  select value into h from settings where key = 'expenses_pin';
  if h is null then return true; end if;              -- no PIN set yet
  return crypt(p_pin, h) = h;
end $$;

create or replace function public.set_pin(p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_perm('people') then raise exception 'Only admins can change the PIN'; end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'The PIN must be 4 to 8 digits'; end if;
  insert into settings(key, value) values ('expenses_pin', crypt(p_pin, gen_salt('bf')))
  on conflict (key) do update set value = excluded.value;
  return true;
end $$;

grant execute on function public.check_pin(text) to authenticated;
grant execute on function public.set_pin(text) to authenticated;

-- ---------- row level security ----------
alter table public.people      enable row level security;
alter table public.crops       enable row level security;
alter table public.blocks      enable row level security;
alter table public.beds        enable row level security;
alter table public.records     enable row level security;
alter table public.products    enable row level security;
alter table public.sales       enable row level security;
alter table public.store_items enable row level security;
alter table public.bills       enable row level security;
alter table public.expenses    enable row level security;
alter table public.settings    enable row level security;   -- no policies: only the PIN functions read it

-- people
drop policy if exists people_read on public.people;
create policy people_read on public.people for select to authenticated using (public.is_member());
drop policy if exists people_write on public.people;
create policy people_write on public.people for all to authenticated using (public.has_perm('people')) with check (public.has_perm('people'));

-- field data: every member can read
do $$
declare t text;
begin
  foreach t in array array['crops','blocks','beds','records','products'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.is_member())', t);
  end loop;
end $$;

drop policy if exists beds_write on public.beds;
create policy beds_write on public.beds for all to authenticated
  using (public.has_perm('field') or public.has_perm('edit_beds'))
  with check (public.has_perm('field') or public.has_perm('edit_beds'));

drop policy if exists records_write on public.records;
create policy records_write on public.records for all to authenticated
  using (public.has_perm('field') or public.has_perm('edit_beds') or public.has_perm('sales'))
  with check (public.has_perm('field') or public.has_perm('edit_beds') or public.has_perm('sales'));

drop policy if exists crops_write on public.crops;
create policy crops_write on public.crops for all to authenticated using (public.has_perm('edit_beds')) with check (public.has_perm('edit_beds'));
drop policy if exists blocks_write on public.blocks;
create policy blocks_write on public.blocks for all to authenticated using (public.has_perm('edit_beds')) with check (public.has_perm('edit_beds'));
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
  using (public.has_perm('edit_beds') or public.has_perm('money')) with check (public.has_perm('edit_beds') or public.has_perm('money'));

-- sales and store
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select to authenticated using (public.has_perm('sales') or public.has_perm('money'));
drop policy if exists sales_write on public.sales;
create policy sales_write on public.sales for all to authenticated using (public.has_perm('sales')) with check (public.has_perm('sales'));
drop policy if exists store_read on public.store_items;
create policy store_read on public.store_items for select to authenticated using (public.is_member());
drop policy if exists store_write on public.store_items;
create policy store_write on public.store_items for all to authenticated
  using (public.has_perm('sales') or public.has_perm('field')) with check (public.has_perm('sales') or public.has_perm('field'));

-- bills: money people only
drop policy if exists bills_all on public.bills;
create policy bills_all on public.bills for all to authenticated using (public.has_perm('money')) with check (public.has_perm('money'));

-- expenses: money people see and change everything; people with only "expenses" see and change their own
drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select to authenticated
  using (public.has_perm('money') or (public.has_perm('expenses') and created_by = public.my_email()));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.has_perm('money') or public.has_perm('expenses'));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (public.has_perm('money') or (public.has_perm('expenses') and created_by = public.my_email()))
  with check (public.has_perm('money') or (public.has_perm('expenses') and created_by = public.my_email()));

-- ---------- photos ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists photos_upload on storage.objects;
create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
