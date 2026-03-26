-- Parsley's Farm — Final combined sync/security migration (Phase 9)
-- Type: Mixed (additive schema changes + function replacement/permissions hardening)
-- Notes:
--   * Preserves BIGINT time fields
--   * Preserves existing RLS model (does not disable or replace table RLS policies)
--   * Keeps is_farm_user() gate as a hard requirement in RPC path

begin;

-- 1) Add sync metadata columns needed by approved code paths.
--    Kept as BIGINT for timestamp fields to match client code.
alter table if exists public.beds            add column if not exists deleted_at bigint;
alter table if exists public.beds            add column if not exists updated_by text;
alter table if exists public.beds            add column if not exists device_id text;

alter table if exists public.sales           add column if not exists deleted_at bigint;
alter table if exists public.sales           add column if not exists updated_by text;
alter table if exists public.sales           add column if not exists device_id text;

alter table if exists public.harvests        add column if not exists deleted_at bigint;
alter table if exists public.harvests        add column if not exists updated_by text;
alter table if exists public.harvests        add column if not exists device_id text;

alter table if exists public.expenses        add column if not exists deleted_at bigint;
alter table if exists public.expenses        add column if not exists updated_by text;
alter table if exists public.expenses        add column if not exists device_id text;

alter table if exists public.activities      add column if not exists deleted_at bigint;
alter table if exists public.activities      add column if not exists updated_by text;
alter table if exists public.activities      add column if not exists device_id text;

alter table if exists public.credit_payments add column if not exists deleted_at bigint;
alter table if exists public.credit_payments add column if not exists updated_by text;
alter table if exists public.credit_payments add column if not exists device_id text;

alter table if exists public.crops           add column if not exists deleted_at bigint;
alter table if exists public.crops           add column if not exists updated_by text;
alter table if exists public.crops           add column if not exists device_id text;

-- 2) Optional performance indexes for sync pull/upsert patterns.
create index if not exists beds_updated_at_idx            on public.beds (updated_at);
create index if not exists beds_deleted_at_idx            on public.beds (deleted_at);
create index if not exists sales_updated_at_idx           on public.sales (updated_at);
create index if not exists sales_deleted_at_idx           on public.sales (deleted_at);
create index if not exists harvests_updated_at_idx        on public.harvests (updated_at);
create index if not exists harvests_deleted_at_idx        on public.harvests (deleted_at);
create index if not exists expenses_updated_at_idx        on public.expenses (updated_at);
create index if not exists expenses_deleted_at_idx        on public.expenses (deleted_at);
create index if not exists activities_updated_at_idx      on public.activities (updated_at);
create index if not exists activities_deleted_at_idx      on public.activities (deleted_at);
create index if not exists credit_payments_updated_at_idx on public.credit_payments (updated_at);
create index if not exists credit_payments_deleted_at_idx on public.credit_payments (deleted_at);
create index if not exists crops_updated_at_idx           on public.crops (updated_at);
create index if not exists crops_deleted_at_idx           on public.crops (deleted_at);

-- 3) Secure batch sync RPC used by the app.
--    SECURITY INVOKER ensures caller RLS still applies.
--    is_farm_user() is required before any write is attempted.
create or replace function public.apply_sync_batch(
  p_table text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_allowed_tables constant text[] := array[
    'beds','sales','harvests','expenses','activities','credit_payments','crops'
  ];
  v_row jsonb;
  v_id text;
  v_data jsonb;
  v_updated_at bigint;
  v_deleted_at bigint;
  v_updated_by text;
  v_device_id text;
  v_processed int := 0;
begin
  if coalesce(public.is_farm_user(), false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_table is null or not (p_table = any(v_allowed_tables)) then
    raise exception 'invalid table: %', p_table using errcode = '22023';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a jsonb array' using errcode = '22023';
  end if;

  for v_row in
    select value from jsonb_array_elements(p_rows)
  loop
    v_id         := nullif(v_row->>'id', '');
    v_data       := coalesce(v_row->'data', '{}'::jsonb);
    v_updated_at := nullif(v_row->>'updated_at', '')::bigint;
    v_deleted_at := nullif(v_row->>'deleted_at', '')::bigint;
    v_updated_by := nullif(v_row->>'updated_by', '');
    v_device_id  := nullif(v_row->>'device_id', '');

    if v_id is null or v_updated_at is null then
      continue;
    end if;

    execute format(
      'insert into public.%I (id, data, updated_at, deleted_at, updated_by, device_id)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update
         set data = excluded.data,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             updated_by = excluded.updated_by,
             device_id = excluded.device_id
       where coalesce(public.%I.updated_at, 0) <= excluded.updated_at',
      p_table, p_table
    )
    using v_id, v_data, v_updated_at, v_deleted_at, v_updated_by, v_device_id;

    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object('ok', true, 'processed', v_processed);
end;
$$;

-- 4) Function execute permissions hardening.
revoke all on function public.apply_sync_batch(text, jsonb) from public;
revoke all on function public.apply_sync_batch(text, jsonb) from anon;
grant execute on function public.apply_sync_batch(text, jsonb) to authenticated;

commit;
