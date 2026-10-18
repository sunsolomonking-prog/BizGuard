-- BizGuard Global Market: additive-only persistence foundation.
-- Existing sales, inventory, POS RPCs, historical amounts, and business currency are not rewritten.
begin;

create table if not exists public.global_market_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reporting_currency text not null default 'NGN' check (reporting_currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en' check (locale in ('en','fr','pt','es','ar')),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.global_fx_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(24,10) not null check (rate > 0 and rate < 1000000000000),
  source text not null check (length(trim(source)) between 1 and 240),
  rate_kind text not null default 'manual' check (rate_kind in ('manual','provider','bank','invoice')),
  effective_at timestamptz not null,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint global_fx_rates_different_currencies check (base_currency <> quote_currency)
);
create index if not exists global_fx_rates_business_pair_effective_idx
  on public.global_fx_rates (business_id, base_currency, quote_currency, effective_at desc);
create index if not exists global_fx_rates_business_created_idx
  on public.global_fx_rates (business_id, created_at desc);

create table if not exists public.global_market_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('preference_updated','fx_rate_created','fx_rate_deleted','report_exported')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists global_market_audit_business_created_idx
  on public.global_market_audit_events (business_id, created_at desc);

alter table public.global_market_preferences enable row level security;
alter table public.global_fx_rates enable row level security;
alter table public.global_market_audit_events enable row level security;

drop policy if exists global_market_preferences_select on public.global_market_preferences;
create policy global_market_preferences_select on public.global_market_preferences
 for select to authenticated using (user_id = auth.uid() and public.user_can_access_business(business_id));
drop policy if exists global_market_preferences_insert on public.global_market_preferences;
create policy global_market_preferences_insert on public.global_market_preferences
 for insert to authenticated with check (user_id = auth.uid() and public.user_can_access_business(business_id));
drop policy if exists global_market_preferences_update on public.global_market_preferences;
create policy global_market_preferences_update on public.global_market_preferences
 for update to authenticated using (user_id = auth.uid() and public.user_can_access_business(business_id))
 with check (user_id = auth.uid() and public.user_can_access_business(business_id));
drop policy if exists global_market_preferences_delete on public.global_market_preferences;
create policy global_market_preferences_delete on public.global_market_preferences
 for delete to authenticated using (user_id = auth.uid() and public.user_can_access_business(business_id));

drop policy if exists global_fx_rates_select on public.global_fx_rates;
create policy global_fx_rates_select on public.global_fx_rates
 for select to authenticated using (public.user_can_access_business(business_id));
drop policy if exists global_fx_rates_insert on public.global_fx_rates;
create policy global_fx_rates_insert on public.global_fx_rates
 for insert to authenticated with check (recorded_by = auth.uid() and public.user_can_access_business(business_id));
drop policy if exists global_fx_rates_delete on public.global_fx_rates;
create policy global_fx_rates_delete on public.global_fx_rates
 for delete to authenticated using (recorded_by = auth.uid() and public.user_can_access_business(business_id));

drop policy if exists global_market_audit_select on public.global_market_audit_events;
create policy global_market_audit_select on public.global_market_audit_events
 for select to authenticated using (public.user_can_access_business(business_id));
drop policy if exists global_market_audit_insert on public.global_market_audit_events;
create policy global_market_audit_insert on public.global_market_audit_events
 for insert to authenticated with check (actor_id = auth.uid() and public.user_can_access_business(business_id));

-- Authenticated users may use the tables only through the RLS policies above.
grant select, insert, update, delete on public.global_market_preferences to authenticated;
grant select, insert, delete on public.global_fx_rates to authenticated;
grant select, insert on public.global_market_audit_events to authenticated;

commit;
