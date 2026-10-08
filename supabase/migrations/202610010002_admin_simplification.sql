-- BizGuard admin + billing reliability migration
-- Safe to run repeatedly. Does not create a replacement users table.

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid null references public.businesses(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  plan_code text not null,
  amount_ngn numeric(14,2) not null default 0,
  provider text not null default 'bank_transfer',
  reference text,
  proof_url text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_requests_status_created_idx
  on public.payment_requests(status, created_at desc);
create index if not exists payment_requests_business_idx
  on public.payment_requests(business_id, created_at desc);

create or replace function public.is_current_user_super_admin()
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
  );
$$;

revoke all on function public.is_current_user_super_admin() from public;
grant execute on function public.is_current_user_super_admin() to authenticated;

alter table public.payment_requests enable row level security;

drop policy if exists payment_requests_admin_read on public.payment_requests;
create policy payment_requests_admin_read
on public.payment_requests for select
using (public.is_current_user_super_admin());

drop policy if exists payment_requests_admin_update on public.payment_requests;
create policy payment_requests_admin_update
on public.payment_requests for update
using (public.is_current_user_super_admin())
with check (public.is_current_user_super_admin());

drop policy if exists payment_requests_owner_insert on public.payment_requests;
create policy payment_requests_owner_insert
on public.payment_requests for insert
with check (auth.uid() = user_id and exists (select 1 from public.users u where u.id = auth.uid() and u.business_id = payment_requests.business_id));

drop policy if exists payment_requests_owner_read on public.payment_requests;
create policy payment_requests_owner_read
on public.payment_requests for select
using (auth.uid() = user_id or public.is_current_user_super_admin());

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  business_id uuid,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_super_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
    select u.id, u.email, u.name, u.business_id, u.role, u.created_at
    from public.users u
    order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_review_payment_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.payment_requests;
  v_plan public.subscription_plans;
  v_now timestamptz := now();
begin
  if not public.is_current_user_super_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select * into v_request
  from public.payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'payment request not found';
  end if;

  if v_request.status <> 'pending' then
    return v_request;
  end if;

  update public.payment_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      admin_note = p_admin_note,
      updated_at = v_now
  where id = p_request_id
  returning * into v_request;

  if p_decision = 'approved' and v_request.business_id is not null then
    select * into v_plan
    from public.subscription_plans
    where code::text = v_request.plan_code
      and is_active = true
    limit 1;

    if not found then
      raise exception 'subscription plan % is not active', v_request.plan_code;
    end if;

    update public.business_subscriptions
    set plan_code = v_request.plan_code,
        status = 'active',
        current_period_started_at = v_now,
        current_period_ends_at = v_now + interval '1 month',
        provider = v_request.provider,
        metadata = jsonb_build_object('payment_request_id', v_request.id, 'approved_by', auth.uid()),
        updated_at = v_now
    where business_id = v_request.business_id;

    if not found then
      insert into public.business_subscriptions (
        business_id, plan_code, status, current_period_started_at,
        current_period_ends_at, provider, metadata, created_at, updated_at
      ) values (
        v_request.business_id, v_request.plan_code, 'active', v_now,
        v_now + interval '1 month', v_request.provider,
        jsonb_build_object('payment_request_id', v_request.id, 'approved_by', auth.uid()),
        v_now, v_now
      );
    end if;
  end if;

  return v_request;
end;
$$;

revoke all on function public.admin_review_payment_request(uuid,text,text) from public;
grant execute on function public.admin_review_payment_request(uuid,text,text) to authenticated;

-- Updated-at trigger is intentionally lightweight and idempotent.
create or replace function public.set_payment_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_requests_updated_at on public.payment_requests;
create trigger payment_requests_updated_at
before update on public.payment_requests
for each row execute function public.set_payment_request_updated_at();

-- Private capture storage. The client only uploads to the authenticated user's folder.
insert into storage.buckets (id, name, public)
values ('bizguard-captures', 'bizguard-captures', false)
on conflict (id) do nothing;

drop policy if exists bizguard_captures_insert on storage.objects;
create policy bizguard_captures_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'bizguard-captures' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists bizguard_captures_select on storage.objects;
create policy bizguard_captures_select
on storage.objects for select to authenticated
using (bucket_id = 'bizguard-captures' and owner_id = auth.uid());

drop policy if exists bizguard_captures_delete on storage.objects;
create policy bizguard_captures_delete
on storage.objects for delete to authenticated
using (bucket_id = 'bizguard-captures' and owner_id = auth.uid());
