-- ============================================================
-- PARSLEY'S FARM v6.1 — Database update
-- Run once in the SQL Editor of your EXISTING v6 project (it keeps all your data).
-- Safe to run twice. For a brand-new project run 01, 02, 03, then this file.
-- ============================================================

-- ---------- beds: survey stamps ----------
alter table public.beds add column if not exists checked_at date;
alter table public.beds add column if not exists checked_by text not null default '';

-- ---------- blocks: planned next crop per hydrant section ----------
alter table public.blocks add column if not exists next_crops jsonb not null default '{}';

-- ---------- crops: how long harvesting lasts (for "section clear by" dates) ----------
alter table public.crops add column if not exists harvest_days int not null default 0;
update public.crops set harvest_days = 120 where id = 'hoho'   and harvest_days = 0;
update public.crops set harvest_days = 10  where id = 'dhania' and harvest_days = 0;
update public.crops set harvest_days = 3   where id = 'kunde'  and harvest_days = 0;
update public.crops set harvest_days = 60  where id = 'basil'  and harvest_days = 0;

-- ---------- bills: who it is for, fixed or water, first month ----------
alter table public.bills add column if not exists person text not null default '';
alter table public.bills add column if not exists kind text not null default 'fixed';     -- fixed | water
alter table public.bills add column if not exists start_month text not null default to_char(current_date, 'YYYY-MM');
update public.bills set person = 'Joel'   where name = 'Salary · Joel'   and person = '';
update public.bills set person = 'Joshua' where name = 'Salary · Joshua' and person = '';

-- ---------- expenses: where the money came from ----------
alter table public.expenses add column if not exists paid_from text not null default 'till'; -- till | cash | personal
alter table public.expenses add column if not exists channel text not null default '';       -- person | paybill | till | other
alter table public.expenses add column if not exists fee numeric not null default 0;
alter table public.expenses add column if not exists payee text not null default '';

-- ---------- money moves: deposits, top-ups, withdrawals, balance checks ----------
create table if not exists public.money_moves (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  kind        text not null,              -- deposit | topup | withdraw | adjust_till | adjust_cash
  amount      numeric not null default 0,
  fee         numeric not null default 0,
  person      text not null default '',
  note        text not null default '',
  deleted     boolean not null default false,
  created_by  text default public.my_email(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- water meter ----------
create table if not exists public.water_readings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  reading     numeric not null,           -- cubic metres on the meter
  rate        numeric not null default 100,   -- KSh per cubic metre
  note        text not null default '',
  deleted     boolean not null default false,
  created_by  text default public.my_email(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- settings the app reads (M-Pesa charges) ----------
create table if not exists public.app_config (
  id          text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['money_moves','water_readings','app_config'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

alter table public.money_moves    enable row level security;
alter table public.water_readings enable row level security;
alter table public.app_config     enable row level security;

drop policy if exists moves_all on public.money_moves;
create policy moves_all on public.money_moves for all to authenticated using (public.has_perm('money')) with check (public.has_perm('money'));

drop policy if exists water_read on public.water_readings;
create policy water_read on public.water_readings for select to authenticated using (public.is_member());
drop policy if exists water_write on public.water_readings;
create policy water_write on public.water_readings for all to authenticated
  using (public.has_perm('field') or public.has_perm('money')) with check (public.has_perm('field') or public.has_perm('money'));

drop policy if exists config_read on public.app_config;
create policy config_read on public.app_config for select to authenticated using (public.is_member());
drop policy if exists config_write on public.app_config;
create policy config_write on public.app_config for all to authenticated using (public.has_perm('money')) with check (public.has_perm('money'));

-- ---------- starting values ----------
-- M-Pesa till charges (Safaricom consumer tariffs page, business till tables). Editable in the app: More → M-Pesa charges.
insert into public.app_config (id, value) values ('fees', '{
  "receive": [[0,500,0],[501,36363,"0.55%"],[36364,250000,200]],
  "person":  [[0,100,0],[101,500,4],[501,1000,7],[1001,1500,12],[1501,2500,17],[2501,3500,27],[3501,5000,29],[5001,7500,39],[7501,10000,45],[10001,15000,50],[15001,20000,53],[20001,250000,54]],
  "paybill": [[0,100,0],[101,500,3],[501,1000,5],[1001,1500,8],[1501,2500,10],[2501,3500,13],[3501,5000,17],[5001,7500,21],[7501,10000,24],[10001,15000,29],[15001,20000,31],[20001,25000,34],[25001,30000,36],[30001,35000,42],[35001,40000,50],[40001,45000,52],[45001,250000,54]],
  "till":    [[0,250000,0]]
}'::jsonb) on conflict (id) do nothing;

-- Last water reading and the water bill
insert into public.water_readings (date, reading, rate, note, created_by)
select '2026-11-01', 2105, 100, 'Starting reading', 'setup'
where not exists (select 1 from public.water_readings);

insert into public.bills (name, category, amount, active, note, sort, person, kind, start_month)
select 'Water', 'Water', 0, true, 'Read the meter on the 3rd', 5, '', 'water', '2026-11'
where not exists (select 1 from public.bills where kind = 'water');

-- Opening till balance
insert into public.money_moves (date, kind, amount, note, created_by)
select '2026-11-12', 'adjust_till', 1.99, 'Opening balance', 'setup'
where not exists (select 1 from public.money_moves);

-- (Sales permission for farm hands is set per person under More -> People and access.)
