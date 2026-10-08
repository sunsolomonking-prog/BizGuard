-- BizGuard targeted subscription/admin/Snap repair
-- Source of truth: BizGuard V44.9.
-- Scope: business-account setup, business_members authorization, and
-- Free/Starter/Pro/Business/Enterprise Snap Count entitlements only.
-- Existing business logic and plan structure are preserved.

-- 1) Canonical business access: a paid plan is NEVER an authorization gate.
-- A user may access a business when:
--   * they are a super admin, OR
--   * public.users links them to it, OR
--   * public.profiles links them to it, OR
--   * they have an active business_members membership.
create or replace function public.user_can_access_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (u.role = 'super_admin' or u.business_id = target_business_id)
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.business_id = target_business_id
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id = target_business_id
      and bm.status = 'active'
  );
$$;

grant execute on function public.user_can_access_business(uuid) to authenticated;

-- 2) Keep the exact five-plan structure from V44.9 and lock Snap limits to it.
update public.subscription_plans
set daily_snap_counts = case code
  when 'free' then 3
  when 'starter' then 8
  when 'pro' then 50
  when 'business' then 100
  when 'enterprise' then null
  else daily_snap_counts
end,
is_unlimited_snap_count = (code = 'enterprise'),
is_active = true,
updated_at = now()
where code in ('free','starter','pro','business','enterprise');

-- 3) Every business has a Free subscription unless it already has one.
insert into public.business_subscriptions (
  business_id, plan_code, status, current_period_started_at, metadata
)
select b.id, 'free', 'active', now(), jsonb_build_object('source','targeted_subscription_repair')
from public.businesses b
where not exists (
  select 1 from public.business_subscriptions s where s.business_id = b.id
);

-- 4) Super-admin self-service business account repair.
-- This does NOT change public.users.role from super_admin.
-- It makes the user the owner of the business through business_members.
create or replace function public.admin_setup_my_business_account(
  p_business_name text default null
)
returns table (
  user_id uuid,
  business_id uuid,
  business_name text,
  user_role text,
  member_role text,
  member_status text,
  plan_code text,
  plan_status text,
  snap_used integer,
  snap_remaining integer,
  snap_daily_limit integer,
  snap_unlimited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user public.users%rowtype;
  v_business public.businesses%rowtype;
  v_business_id uuid;
  v_business_name text;
  v_plan_code text := 'free';
  v_plan_status text := 'active';
  v_snap_used integer := 0;
  v_snap_limit integer := 3;
  v_snap_unlimited boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user_super_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select * into v_user from public.users where id = v_user_id for update;

  if v_user.id is null then
    raise exception 'Admin profile not found in public.users';
  end if;

  -- Prefer the business already attached to the account.
  if v_user.business_id is not null then
    select * into v_business from public.businesses where id = v_user.business_id;
  end if;

  -- If no business is attached, reuse the authenticated business_id metadata
  -- only when it is a valid UUID and points to an existing business.
  if v_business.id is null then
    begin
      if (auth.jwt()->'user_metadata'->>'business_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        select * into v_business
        from public.businesses
        where id = (auth.jwt()->'user_metadata'->>'business_id')::uuid;
      end if;
    exception when others then
      v_business := null;
    end;
  end if;

  -- Last resort: create the business workspace. This is workspace creation,
  -- not paid subscription activation.
  if v_business.id is null then
    v_business_name := coalesce(
      nullif(btrim(p_business_name), ''),
      nullif(btrim(auth.jwt()->'user_metadata'->>'business_name'), ''),
      'My BizGuard Business'
    );

    insert into public.businesses (
      name, industry, type, location, currency, timezone
    ) values (
      v_business_name, 'General', 'retail', '', 'NGN', 'Africa/Lagos'
    )
    returning * into v_business;
  end if;

  v_business_id := v_business.id;

  update public.users
  set business_id = v_business_id
  where id = v_user_id;

  -- Keep the profile store aligned when present in this production schema.
  update public.profiles
  set business_id = v_business_id,
      updated_at = now()
  where id = v_user_id;

  -- V44.9 role compatibility: business_members accepts owner/manager/staff.
  insert into public.business_members (business_id, user_id, role, status)
  values (v_business_id, v_user_id, 'owner', 'active')
  on conflict (business_id, user_id) do update
  set role = 'owner',
      status = 'active';

  -- Free is the default. Existing paid subscriptions are preserved.
  insert into public.business_subscriptions (
    business_id, plan_code, status, current_period_started_at, metadata
  )
  values (
    v_business_id, 'free', 'active', now(),
    jsonb_build_object('source','admin_business_account_setup')
  )
  on conflict do nothing;

  select bs.plan_code, bs.status
  into v_plan_code, v_plan_status
  from public.business_subscriptions bs
  where bs.business_id = v_business_id
  order by bs.updated_at desc, bs.created_at desc
  limit 1;

  select coalesce(s.snap_counts_used, 0)
  into v_snap_used
  from public.snap_count_usage s
  where s.business_id = v_business_id
    and s.usage_date = current_date;

  select p.daily_snap_counts, p.is_unlimited_snap_count
  into v_snap_limit, v_snap_unlimited
  from public.subscription_plans p
  where p.code = coalesce(v_plan_code, 'free')
    and p.is_active = true
  limit 1;

  return query
  select
    v_user_id,
    v_business_id,
    v_business.name,
    'super_admin'::text,
    'owner'::text,
    'active'::text,
    coalesce(v_plan_code,'free'),
    coalesce(v_plan_status,'active'),
    v_snap_used,
    case when v_snap_unlimited then null else greatest(coalesce(v_snap_limit,3) - v_snap_used, 0) end,
    v_snap_limit,
    v_snap_unlimited;
end;
$$;

revoke all on function public.admin_setup_my_business_account(text) from public;
grant execute on function public.admin_setup_my_business_account(text) to authenticated;

-- 5) Read-only admin diagnostic. Useful for verifying the exact chain without
-- granting access to arbitrary businesses.
create or replace function public.admin_get_my_business_account_status()
returns table (
  business_id uuid,
  business_name text,
  member_role text,
  member_status text,
  plan_code text,
  plan_status text,
  snap_used integer,
  snap_remaining integer,
  snap_daily_limit integer,
  snap_unlimited boolean,
  ready boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_plan_code text := 'free';
  v_plan_status text := 'active';
  v_limit integer := 3;
  v_unlimited boolean := false;
  v_used integer := 0;
  v_member_role text;
  v_member_status text;
  v_name text;
begin
  if v_user_id is null or not public.is_current_user_super_admin() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  select u.business_id into v_business_id
  from public.users u
  where u.id = v_user_id;

  if v_business_id is null then
    return query select null::uuid,null::text,null::text,null::text,'free','active',0,3,3,false,false;
    return;
  end if;

  select b.name into v_name from public.businesses b where b.id=v_business_id;

  select bm.role,bm.status into v_member_role,v_member_status
  from public.business_members bm
  where bm.business_id=v_business_id and bm.user_id=v_user_id
  limit 1;

  select bs.plan_code,bs.status into v_plan_code,v_plan_status
  from public.business_subscriptions bs
  where bs.business_id=v_business_id
  order by bs.updated_at desc,bs.created_at desc
  limit 1;

  select p.daily_snap_counts,p.is_unlimited_snap_count
  into v_limit,v_unlimited
  from public.subscription_plans p
  where p.code=coalesce(v_plan_code,'free') and p.is_active=true
  limit 1;

  select coalesce(s.snap_counts_used,0) into v_used
  from public.snap_count_usage s
  where s.business_id=v_business_id and s.usage_date=current_date;

  return query
  select v_business_id,v_name,v_member_role,v_member_status,
    coalesce(v_plan_code,'free'),coalesce(v_plan_status,'active'),
    v_used,
    case when v_unlimited then null else greatest(coalesce(v_limit,3)-v_used,0) end,
    v_limit,v_unlimited,
    (v_member_role='owner' and v_member_status='active'
      and coalesce(v_plan_status,'active')='active'
      and coalesce(v_plan_code,'free') in ('free','starter','pro','business','enterprise'));
end;
$$;

revoke all on function public.admin_get_my_business_account_status() from public;
grant execute on function public.admin_get_my_business_account_status() to authenticated;
