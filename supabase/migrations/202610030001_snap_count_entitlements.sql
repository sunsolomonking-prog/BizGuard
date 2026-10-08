-- BizGuard Snap Count subscription entitlements.
-- Daily limits intentionally mirror the existing subscription capacity tiers:
-- Free 3, Starter 8, Pro 50, Business 100, Enterprise unlimited.
-- The database is authoritative; client state/localStorage never grants Snap Counts.

alter table public.subscription_plans
  add column if not exists daily_snap_counts integer,
  add column if not exists is_unlimited_snap_count boolean not null default false;

update public.subscription_plans set daily_snap_counts = case code
  when 'free' then 3
  when 'starter' then 8
  when 'pro' then 50
  when 'business' then 100
  when 'enterprise' then null
  else coalesce(daily_snap_counts, 0)
end,
is_unlimited_snap_count = (code = 'enterprise'),
updated_at = now();

create table if not exists public.snap_count_usage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  snap_counts_used integer not null default 0 check (snap_counts_used >= 0),
  last_snap_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, usage_date)
);

create index if not exists snap_count_usage_business_date_idx
  on public.snap_count_usage(business_id, usage_date desc);

create table if not exists public.snap_count_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending','consumed','released')),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snap_count_reservations_lookup_idx
  on public.snap_count_reservations(business_id, usage_date, status, expires_at);

create or replace function public.get_snap_count_usage_status(target_business_id uuid)
returns table (
  business_id uuid,
  plan_code text,
  plan_name text,
  used_today integer,
  remaining_today integer,
  daily_limit integer,
  is_unlimited boolean,
  reset_at timestamptz,
  upgrade_message text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_used integer := 0;
  v_reset timestamptz := date_trunc('day', now() at time zone 'UTC') + interval '1 day';
begin
  if not public.user_can_access_business(target_business_id) then
    raise exception 'business access required' using errcode = '42501';
  end if;

  select p.code as plan_code, p.name as plan_name, p.daily_snap_counts, p.is_unlimited_snap_count
  into v_plan
  from public.subscription_plans p
  left join lateral (
    select bs.plan_code
    from public.business_subscriptions bs
    where bs.business_id = target_business_id
    order by bs.updated_at desc, bs.created_at desc
    limit 1
  ) s on true
  where p.code = coalesce(s.plan_code, 'free') and p.is_active = true
  limit 1;
  if not found then raise exception 'subscription plan unavailable'; end if;

  select coalesce(snap_counts_used, 0) into v_used
  from public.snap_count_usage
  where business_id = target_business_id and usage_date = current_date
  limit 1;

  return query
  select target_business_id,
    v_plan.plan_code,
    v_plan.plan_name,
    v_used,
    case when v_plan.is_unlimited_snap_count then null else greatest(v_plan.daily_snap_counts - v_used, 0) end,
    v_plan.daily_snap_counts,
    v_plan.is_unlimited_snap_count,
    v_reset,
    case
      when v_plan.is_unlimited_snap_count then 'Unlimited Snap Count enabled.'
      when greatest(v_plan.daily_snap_counts - v_used, 0) = 0 then 'You have reached today''s Snap Count limit. Upgrade your BizGuard plan to continue.'
      else concat(greatest(v_plan.daily_snap_counts - v_used, 0), ' Snap Count', case when greatest(v_plan.daily_snap_counts - v_used, 0) = 1 then '' else 's' end, ' remaining today.')
    end;
end;
$$;

grant execute on function public.get_snap_count_usage_status(uuid) to authenticated;

create or replace function public.reserve_snap_count(target_business_id uuid)
returns table (
  allowed boolean,
  reservation_id uuid,
  plan_code text,
  used_today integer,
  remaining_today integer,
  daily_limit integer,
  is_unlimited boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan record;
  v_usage public.snap_count_usage;
  v_reservation uuid;
  v_used integer := 0;
  v_remaining integer;
begin
  if v_user is null or not public.user_can_access_business(target_business_id) then
    raise exception 'business access required' using errcode = '42501';
  end if;

  select p.code as plan_code, p.name as plan_name, p.daily_snap_counts, p.is_unlimited_snap_count
  into v_plan
  from public.subscription_plans p
  left join lateral (
    select bs.plan_code
    from public.business_subscriptions bs
    where bs.business_id = target_business_id
    order by bs.updated_at desc, bs.created_at desc
    limit 1
  ) s on true
  where p.code = coalesce(s.plan_code, 'free') and p.is_active = true
  limit 1;
  if not found then raise exception 'subscription plan unavailable'; end if;

  insert into public.snap_count_usage (business_id, user_id, usage_date)
  values (target_business_id, v_user, current_date)
  on conflict (business_id, usage_date) do nothing;

  select * into v_usage
  from public.snap_count_usage
  where business_id = target_business_id and usage_date = current_date
  for update;

  -- Expire abandoned reservations and return their slots before enforcing the limit.
  with expired as (
    select id
    from public.snap_count_reservations
    where business_id = target_business_id
      and usage_date = current_date
      and status = 'pending'
      and expires_at < now()
    for update
  ), released as (
    update public.snap_count_reservations r
    set status = 'released', updated_at = now()
    from expired e
    where r.id = e.id
    returning r.id
  )
  update public.snap_count_usage u
  set snap_counts_used = greatest(u.snap_counts_used - (select count(*)::integer from released), 0),
      updated_at = now()
  where u.id = v_usage.id;

  select * into v_usage
  from public.snap_count_usage
  where id = v_usage.id
  for update;
  v_used := coalesce(v_usage.snap_counts_used, 0);

  if not v_plan.is_unlimited_snap_count and v_used >= coalesce(v_plan.daily_snap_counts, 0) then
    return query select false, null::uuid, v_plan.plan_code, v_used, 0, v_plan.daily_snap_counts, false,
      'You have reached today''s Snap Count limit. Upgrade your BizGuard plan to continue.';
    return;
  end if;

  update public.snap_count_usage
  set snap_counts_used = snap_counts_used + 1,
      last_snap_at = now(),
      updated_at = now()
  where id = v_usage.id
  returning snap_counts_used into v_used;

  insert into public.snap_count_reservations (business_id, user_id, usage_date, status)
  values (target_business_id, v_user, current_date, 'pending')
  returning id into v_reservation;

  v_remaining := case when v_plan.is_unlimited_snap_count then null else greatest(v_plan.daily_snap_counts - v_used, 0) end;

  return query select true, v_reservation, v_plan.plan_code, v_used, v_remaining,
    v_plan.daily_snap_counts, v_plan.is_unlimited_snap_count,
    case when v_plan.is_unlimited_snap_count then 'Unlimited Snap Count enabled.' else concat(v_remaining, ' Snap Count', case when v_remaining = 1 then '' else 's' end, ' remaining today.') end;
end;
$$;

grant execute on function public.reserve_snap_count(uuid) to authenticated;

create or replace function public.commit_snap_count(target_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.snap_count_reservations
  set status = 'consumed', updated_at = now()
  where id = target_reservation_id
    and user_id = auth.uid()
    and status = 'pending';
  return found;
end;
$$;

grant execute on function public.commit_snap_count(uuid) to authenticated;

create or replace function public.release_snap_count(target_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_usage_id uuid;
begin
  select business_id into v_business
  from public.snap_count_reservations
  where id = target_reservation_id
    and user_id = auth.uid()
    and status = 'pending'
  for update;

  if v_business is null then return false; end if;

  update public.snap_count_reservations
  set status = 'released', updated_at = now()
  where id = target_reservation_id and user_id = auth.uid() and status = 'pending';

  if not found then return false; end if;

  select id into v_usage_id
  from public.snap_count_usage
  where business_id = v_business and usage_date = current_date
  for update;

  if v_usage_id is not null then
    update public.snap_count_usage
    set snap_counts_used = greatest(snap_counts_used - 1, 0), updated_at = now()
    where id = v_usage_id;
  end if;

  return true;
end;
$$;

grant execute on function public.release_snap_count(uuid) to authenticated;

create or replace function public.set_subscription_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists snap_count_usage_updated_at on public.snap_count_usage;
create trigger snap_count_usage_updated_at before update on public.snap_count_usage for each row execute function public.set_subscription_updated_at();
drop trigger if exists snap_count_reservations_updated_at on public.snap_count_reservations;
create trigger snap_count_reservations_updated_at before update on public.snap_count_reservations for each row execute function public.set_subscription_updated_at();

alter table public.snap_count_usage enable row level security;
drop policy if exists snap_count_usage_read on public.snap_count_usage;
create policy snap_count_usage_read on public.snap_count_usage for select to authenticated using (public.user_can_access_business(business_id));

alter table public.snap_count_reservations enable row level security;
drop policy if exists snap_count_reservations_read on public.snap_count_reservations;
create policy snap_count_reservations_read on public.snap_count_reservations for select to authenticated using (user_id = auth.uid());
