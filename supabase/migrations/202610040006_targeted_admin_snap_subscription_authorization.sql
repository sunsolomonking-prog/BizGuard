-- BizGuard targeted authorization/entitlement hardening.
-- Scope locked to Admin business setup, Snap Count/Snap Sale access, and the
-- existing five subscription tiers. No other product behavior is changed.

-- Super admins may access an existing selected business without requiring
-- public.users.business_id to be populated first. Normal users remain tenant
-- isolated through users/profiles/business_members.
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

grant execute on function public.user_can_access_business(uuid) to authenticated;

-- Canonical Snap Count limits.
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

-- Ensure every business has exactly a usable baseline subscription when none exists.
insert into public.business_subscriptions (business_id, plan_code, status, current_period_started_at, metadata)
select b.id, 'free', 'active', now(), jsonb_build_object('source','targeted_admin_snap_subscription_authorization')
from public.businesses b
where not exists (select 1 from public.business_subscriptions s where s.business_id = b.id);

-- Admin repair remains the supported way to attach the current super admin to a
-- workspace. It never changes the user's super_admin role.
