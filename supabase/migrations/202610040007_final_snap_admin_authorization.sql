-- BizGuard FINAL TARGETED SNAP/ADMIN AUTHORIZATION REPAIR
-- Scope is intentionally locked to:
--   * Admin business workspace linking
--   * business_members authorization
--   * Free/Starter/Pro/Business/Enterprise Snap Count entitlements
--   * Snap Sale / Snap Count Vision authorization
-- No unrelated product behavior is changed.

-- Canonical plan limits. A paid Business subscription is never an authorization gate.
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

-- Canonical tenant access function used by Snap Count RPCs and RLS.
-- Super admins may work with an explicitly selected existing business.
-- Normal users require an actual tenant relationship.
create or replace function public.user_can_access_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'super_admin'
      and exists (select 1 from public.businesses b where b.id = target_business_id)
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.business_id = target_business_id
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.business_id = target_business_id
  )
  or exists (
    select 1 from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id = target_business_id
      and bm.status = 'active'
  );
$$;
revoke all on function public.user_can_access_business(uuid) from public;
grant execute on function public.user_can_access_business(uuid) to authenticated;

-- Server-side repair immediately before Snap analysis.
-- This is deliberately narrower than arbitrary business access:
--   * super_admin: selected existing business may be linked and owned
--   * normal user: only an already-linked users/profiles/member business may be repaired
create or replace function public.prepare_snap_business_access(p_business_id uuid)
returns table (
  business_id uuid,
  member_role text,
  member_status text,
  plan_code text,
  ready boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user public.users%rowtype;
  v_profile public.profiles%rowtype;
  v_business public.businesses%rowtype;
  v_role text;
  v_plan text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_business_id is null then raise exception 'Business is required' using errcode='22023'; end if;

  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then raise exception 'Selected BizGuard business was not found' using errcode='P0002'; end if;

  select * into v_user from public.users where id = v_user_id;
  select * into v_profile from public.profiles where id = v_user_id;

  if v_user.role = 'super_admin' then
    update public.users
       set business_id = p_business_id
     where id = v_user_id;

    update public.profiles
       set business_id = p_business_id,
           updated_at = now()
     where id = v_user_id;

    v_role := 'owner';
  elsif v_user.business_id = p_business_id or v_profile.business_id = p_business_id then
    v_role := case
      when coalesce(v_user.role, '') = 'manager' then 'manager'
      when coalesce(v_user.role, '') = 'staff' then 'staff'
      when coalesce(v_user.role, '') = 'viewer' then 'staff'
      else 'owner'
    end;
  elsif exists (
    select 1 from public.business_members bm
    where bm.user_id = v_user_id
      and bm.business_id = p_business_id
      and bm.status = 'active'
  ) then
    select case when bm.role in ('owner','manager','staff') then bm.role else 'owner' end
      into v_role
    from public.business_members bm
    where bm.user_id = v_user_id and bm.business_id = p_business_id and bm.status = 'active'
    limit 1;
  else
    raise exception 'Business access required. Link this account to a BizGuard business workspace in Admin Portal.' using errcode='42501';
  end if;

  insert into public.business_members (business_id, user_id, role, status)
  values (p_business_id, v_user_id, coalesce(v_role,'owner'), 'active')
  on conflict (business_id, user_id) do update
    set role = excluded.role,
        status = 'active';

  insert into public.business_subscriptions (business_id, plan_code, status, current_period_started_at, metadata)
  values (p_business_id, 'free', 'active', now(), jsonb_build_object('source','snap_access_repair'))
  on conflict do nothing;

  select bs.plan_code into v_plan
  from public.business_subscriptions bs
  where bs.business_id = p_business_id
  order by bs.updated_at desc, bs.created_at desc
  limit 1;

  return query
  select p_business_id, coalesce(v_role,'owner'), 'active'::text, coalesce(v_plan,'free'), true;
end;
$$;
revoke all on function public.prepare_snap_business_access(uuid) from public;
grant execute on function public.prepare_snap_business_access(uuid) to authenticated;

-- Admin setup now accepts the actual selected business ID. This prevents the
-- previous failure mode where Admin Portal created a second business named
-- "2040Ai future store" while Snap was still using the existing selected business.
drop function if exists public.admin_setup_my_business_account(text);
create or replace function public.admin_setup_my_business_account(
  p_business_id uuid default null,
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
  v_business_id uuid := p_business_id;
  v_plan_code text := 'free';
  v_plan_status text := 'active';
  v_limit integer := 3;
  v_unlimited boolean := false;
  v_used integer := 0;
  v_name text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.is_current_user_super_admin() then raise exception 'admin access required' using errcode='42501'; end if;

  select * into v_user from public.users where id = v_user_id for update;
  if v_user.id is null then raise exception 'Admin profile not found in public.users'; end if;

  -- Prefer the explicitly selected business, then the existing user link.
  if v_business_id is not null then
    select * into v_business from public.businesses where id = v_business_id;
    if v_business.id is null then raise exception 'Selected BizGuard business was not found'; end if;
  elsif v_user.business_id is not null then
    select * into v_business from public.businesses where id = v_user.business_id;
  end if;

  -- Reuse an existing exact-name business before ever creating a new one.
  if v_business.id is null and nullif(btrim(p_business_name),'') is not null then
    select * into v_business
    from public.businesses
    where lower(btrim(name)) = lower(btrim(p_business_name))
    order by created_at desc
    limit 1;
  end if;

  if v_business.id is null then
    v_name := coalesce(nullif(btrim(p_business_name),''), 'My BizGuard Business');
    insert into public.businesses (name, industry, type, location, currency, timezone)
    values (v_name, 'General', 'retail', '', 'NGN', 'Africa/Lagos')
    returning * into v_business;
  end if;

  v_business_id := v_business.id;

  update public.users set business_id = v_business_id where id = v_user_id;
  update public.profiles set business_id = v_business_id, updated_at = now() where id = v_user_id;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business_id, v_user_id, 'owner', 'active')
  on conflict (business_id, user_id) do update set role='owner', status='active';

  insert into public.business_subscriptions (business_id, plan_code, status, current_period_started_at, metadata)
  values (v_business_id, 'free', 'active', now(), jsonb_build_object('source','admin_business_account_setup'))
  on conflict do nothing;

  select bs.plan_code, bs.status into v_plan_code, v_plan_status
  from public.business_subscriptions bs
  where bs.business_id = v_business_id
  order by bs.updated_at desc, bs.created_at desc
  limit 1;

  select p.daily_snap_counts, p.is_unlimited_snap_count
    into v_limit, v_unlimited
  from public.subscription_plans p
  where p.code = coalesce(v_plan_code,'free') and p.is_active=true
  limit 1;

  select coalesce(s.snap_counts_used,0) into v_used
  from public.snap_count_usage s
  where s.business_id=v_business_id and s.usage_date=current_date;

  return query select
    v_user_id, v_business_id, v_business.name, 'super_admin'::text, 'owner'::text, 'active'::text,
    coalesce(v_plan_code,'free'), coalesce(v_plan_status,'active'), v_used,
    case when v_unlimited then null else greatest(coalesce(v_limit,3)-v_used,0) end,
    v_limit, v_unlimited;
end;
$$;
revoke all on function public.admin_setup_my_business_account(uuid,text) from public;
grant execute on function public.admin_setup_my_business_account(uuid,text) to authenticated;

-- Recreate the diagnostic so it reports the same business that Admin Portal
-- actually repaired.
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
  v_name text;
  v_member_role text;
  v_member_status text;
  v_plan_code text := 'free';
  v_plan_status text := 'active';
  v_limit integer := 3;
  v_unlimited boolean := false;
  v_used integer := 0;
begin
  if v_user_id is null or not public.is_current_user_super_admin() then raise exception 'admin access required' using errcode='42501'; end if;
  select u.business_id into v_business_id from public.users u where u.id=v_user_id;
  if v_business_id is null then
    return query select null::uuid,null::text,null::text,null::text,'free','active',0,3,3,false,false;
    return;
  end if;
  select b.name into v_name from public.businesses b where b.id=v_business_id;
  select bm.role,bm.status into v_member_role,v_member_status
  from public.business_members bm where bm.business_id=v_business_id and bm.user_id=v_user_id limit 1;
  select bs.plan_code,bs.status into v_plan_code,v_plan_status
  from public.business_subscriptions bs where bs.business_id=v_business_id
  order by bs.updated_at desc,bs.created_at desc limit 1;
  select p.daily_snap_counts,p.is_unlimited_snap_count into v_limit,v_unlimited
  from public.subscription_plans p where p.code=coalesce(v_plan_code,'free') and p.is_active=true limit 1;
  select coalesce(s.snap_counts_used,0) into v_used from public.snap_count_usage s where s.business_id=v_business_id and s.usage_date=current_date;
  return query select v_business_id,v_name,v_member_role,v_member_status,coalesce(v_plan_code,'free'),coalesce(v_plan_status,'active'),v_used,
    case when v_unlimited then null else greatest(coalesce(v_limit,3)-v_used,0) end,v_limit,v_unlimited,
    (v_member_role='owner' and v_member_status='active' and coalesce(v_plan_status,'active')='active');
end;
$$;
revoke all on function public.admin_get_my_business_account_status() from public;
grant execute on function public.admin_get_my_business_account_status() to authenticated;
