-- BizGuard targeted payment receipt + approval flow hardening.
-- Additive only: preserves payment_requests, Admin Portal approval, and business_subscriptions.

-- Payment requests may be submitted by an authenticated user who is linked through
-- either the canonical users.business_id path or an active business_members membership.
drop policy if exists payment_requests_owner_insert on public.payment_requests;
create policy payment_requests_owner_insert
on public.payment_requests
for insert to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.business_id = payment_requests.business_id
    )
    or exists (
      select 1
      from public.business_members bm
      where bm.user_id = auth.uid()
        and bm.business_id = payment_requests.business_id
        and bm.status = 'active'
    )
  )
);

-- Harden receipt visibility: payment proofs are private, but Super Admins must
-- be able to inspect the uploaded proof from the existing Admin Portal.
drop policy if exists bizguard_captures_admin_select on storage.objects;
create policy bizguard_captures_admin_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'bizguard-captures'
  and public.is_current_user_super_admin()
);

-- Make payment submission server-authoritative. The browser may upload proof,
-- but the database decides whether the request can be created, verifies the
-- selected plan/amount, and prevents more than one pending request per business.
create or replace function public.create_payment_request(
  p_business_id uuid,
  p_plan_code text,
  p_amount_ngn numeric,
  p_provider text default 'bank_transfer',
  p_reference text default null,
  p_proof_url text default null,
  p_note text default null
)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.subscription_plans;
  v_existing public.payment_requests;
  v_request public.payment_requests;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '40100';
  end if;

  if p_business_id is null then
    raise exception 'business workspace is required';
  end if;

  -- Serialize payment-request creation per business so two rapid/concurrent
  -- submissions cannot both pass the pending-request check.
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  if not (
    exists (
      select 1 from public.users u
      where u.id = v_user_id and u.business_id = p_business_id
    )
    or exists (
      select 1 from public.business_members bm
      where bm.user_id = v_user_id
        and bm.business_id = p_business_id
        and bm.status = 'active'
    )
  ) then
    raise exception 'business access required' using errcode = '42501';
  end if;

  select * into v_plan
  from public.subscription_plans
  where code::text = p_plan_code
    and is_active = true
  limit 1;

  if not found then
    raise exception 'subscription plan % is not active', p_plan_code;
  end if;

  if p_plan_code = 'free' then
    raise exception 'free plan does not require a payment request';
  end if;

  if p_amount_ngn is null or p_amount_ngn <> v_plan.monthly_price_ngn then
    raise exception 'payment amount does not match the selected plan';
  end if;

  if coalesce(p_provider, '') <> 'bank_transfer' then
    raise exception 'unsupported payment provider';
  end if;

  if p_proof_url is null or length(trim(p_proof_url)) = 0 then
    raise exception 'payment proof is required';
  end if;

  select * into v_existing
  from public.payment_requests
  where business_id = p_business_id
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if found then
    raise exception 'a payment request is already awaiting admin approval' using errcode = '23505';
  end if;

  insert into public.payment_requests (
    business_id, user_id, plan_code, amount_ngn, provider,
    reference, proof_url, note, status
  ) values (
    p_business_id, v_user_id, p_plan_code, p_amount_ngn, 'bank_transfer',
    nullif(trim(p_reference), ''), p_proof_url, nullif(trim(p_note), ''), 'pending'
  )
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.create_payment_request(uuid,text,numeric,text,text,text,text) from public;
grant execute on function public.create_payment_request(uuid,text,numeric,text,text,text,text) to authenticated;

-- Defense in depth for approval: verify the amount and proof against the real
-- active plan before any subscription state is changed.
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

  if p_decision = 'approved' then
    select * into v_plan
    from public.subscription_plans
    where code::text = v_request.plan_code
      and is_active = true
    limit 1;

    if not found then
      raise exception 'subscription plan % is not active', v_request.plan_code;
    end if;

    if v_request.business_id is null then
      raise exception 'payment request has no business workspace';
    end if;

    if v_request.proof_url is null or length(trim(v_request.proof_url)) = 0 then
      raise exception 'payment proof is required before approval';
    end if;

    if v_request.amount_ngn <> v_plan.monthly_price_ngn then
      raise exception 'payment amount does not match the selected plan';
    end if;
  end if;

  update public.payment_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      admin_note = p_admin_note,
      updated_at = v_now
  where id = p_request_id
  returning * into v_request;

  if p_decision = 'approved' then
    update public.business_subscriptions
    set plan_code = v_request.plan_code,
        status = 'active',
        current_period_started_at = v_now,
        current_period_ends_at = v_now + interval '1 month',
        provider = v_request.provider,
        cancel_at_period_end = false,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'payment_request_id', v_request.id,
          'approved_by', auth.uid(),
          'approved_at', v_now,
          'payment_reference', v_request.reference
        ),
        updated_at = v_now
    where business_id = v_request.business_id;

    if not found then
      insert into public.business_subscriptions (
        business_id, plan_code, status, current_period_started_at,
        current_period_ends_at, provider, cancel_at_period_end, metadata
      ) values (
        v_request.business_id, v_request.plan_code, 'active', v_now,
        v_now + interval '1 month', v_request.provider, false,
        jsonb_build_object(
          'payment_request_id', v_request.id,
          'approved_by', auth.uid(),
          'approved_at', v_now,
          'payment_reference', v_request.reference
        )
      );
    end if;
  end if;

  return v_request;
end;
$$;

revoke all on function public.admin_review_payment_request(uuid,text,text) from public;
grant execute on function public.admin_review_payment_request(uuid,text,text) to authenticated;


-- Keep payment review inside the existing Admin Portal, while returning the
-- human-readable user/business context the administrator needs to verify a request.
create or replace function public.admin_list_payment_requests()
returns table (
  id uuid,
  business_id uuid,
  user_id uuid,
  plan_code text,
  amount_ngn numeric,
  provider text,
  reference text,
  proof_url text,
  note text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz,
  updated_at timestamptz,
  user_name text,
  user_email text,
  business_name text
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
  select
    pr.id,
    pr.business_id,
    pr.user_id,
    pr.plan_code,
    pr.amount_ngn,
    pr.provider,
    pr.reference,
    pr.proof_url,
    pr.note,
    pr.status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.admin_note,
    pr.created_at,
    pr.updated_at,
    u.name,
    u.email,
    b.name
  from public.payment_requests pr
  left join public.users u on u.id = pr.user_id
  left join public.businesses b on b.id = pr.business_id
  order by pr.created_at desc
  limit 100;
end;
$$;

revoke all on function public.admin_list_payment_requests() from public;
grant execute on function public.admin_list_payment_requests() to authenticated;
