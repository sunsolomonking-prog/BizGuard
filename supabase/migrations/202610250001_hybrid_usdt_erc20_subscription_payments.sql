-- BizGuard additive hybrid payment support: bank transfer + manually verified USDT ERC-20.
-- Crypto approvals remain gated by a Super Admin and require explicit verification attestation.
-- No existing plan, entitlement, or bank-transfer workflow is removed.

-- Prevent the same Ethereum transaction hash being submitted against multiple
-- USDT payment requests. Existing bank-transfer references remain unaffected.
create unique index if not exists payment_requests_usdt_tx_hash_uidx
  on public.payment_requests (lower(reference))
  where provider = 'usdt_erc20' and reference is not null;

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
  v_provider text := lower(trim(coalesce(p_provider, 'bank_transfer')));
  v_reference text := nullif(trim(p_reference), '');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_business_id is null then raise exception 'business workspace is required'; end if;
  if v_provider not in ('bank_transfer', 'usdt_erc20') then
    raise exception 'unsupported payment provider';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  if not (
    exists (select 1 from public.users u where u.id = v_user_id and u.business_id = p_business_id)
    or exists (select 1 from public.profiles pr where pr.id = v_user_id and pr.business_id = p_business_id)
    or exists (select 1 from public.business_members bm where bm.user_id = v_user_id and bm.business_id = p_business_id and bm.status = 'active')
  ) then raise exception 'business access required'; end if;

  select * into v_plan from public.subscription_plans
  where code::text = p_plan_code and is_active = true limit 1;
  if not found then raise exception 'subscription plan % is not active', p_plan_code; end if;
  if p_plan_code = 'free' then raise exception 'free plan does not require a payment request'; end if;
  if p_amount_ngn is null or p_amount_ngn <> v_plan.monthly_price_ngn then
    raise exception 'payment amount does not match the selected plan';
  end if;
  if p_proof_url is null or length(trim(p_proof_url)) = 0 then
    raise exception 'payment proof is required';
  end if;
  if split_part(p_proof_url, '/', 1) <> v_user_id::text then
    raise exception 'payment proof ownership could not be verified';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'bizguard-captures'
      and o.name = p_proof_url
      and o.owner_id = v_user_id::text
  ) then raise exception 'payment proof upload could not be verified'; end if;

  if v_provider = 'usdt_erc20' then
    if v_reference is null or v_reference !~ '^0x[0-9a-fA-F]{64}$' then
      raise exception 'a valid Ethereum transaction hash is required for USDT ERC-20';
    end if;
    if coalesce(p_note, '') !~* 'USDT on Ethereum ERC-20 mainnet' then
      raise exception 'USDT payment must explicitly identify Ethereum ERC-20 mainnet';
    end if;
  end if;

  select * into v_existing from public.payment_requests
  where business_id = p_business_id and status = 'pending'
  order by created_at desc limit 1 for update;
  if found then return v_existing; end if;

  insert into public.payment_requests (
    business_id, user_id, plan_code, amount_ngn, provider, reference, proof_url, note, status
  ) values (
    p_business_id, v_user_id, p_plan_code, p_amount_ngn, v_provider, v_reference,
    p_proof_url, nullif(trim(p_note), ''), 'pending'
  ) returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.create_payment_request(uuid,text,numeric,text,text,text,text) from public;
grant execute on function public.create_payment_request(uuid,text,numeric,text,text,text,text) to authenticated;


create or replace function public.admin_review_payment_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.payment_requests%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_now timestamptz := now();
begin
  if not public.is_current_user_super_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_request
  from public.payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'payment request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'request_id', v_request.id,
      'status', v_request.status
    );
  end if;

  if p_decision = 'approved' then
    if v_request.business_id is null then
      raise exception 'payment request has no business workspace' using errcode = '22023';
    end if;

    if v_request.proof_url is null or length(trim(v_request.proof_url)) = 0 then
      raise exception 'payment proof is required before approval' using errcode = '22023';
    end if;

    select * into v_plan
    from public.subscription_plans
    where code::text = v_request.plan_code and is_active = true
    limit 1;

    if not found then
      raise exception 'subscription plan % is not active', v_request.plan_code using errcode = '22023';
    end if;

    if v_request.amount_ngn is null or v_request.amount_ngn <> v_plan.monthly_price_ngn then
      raise exception 'payment amount does not match the selected subscription plan' using errcode = '22023';
    end if;

    if v_request.provider = 'usdt_erc20' then
      if v_request.reference is null or v_request.reference !~ '^0x[0-9a-fA-F]{64}$' then
        raise exception 'valid Ethereum transaction hash required before crypto approval' using errcode = '22023';
      end if;
      if coalesce(p_admin_note, '') !~* 'manually verified on Etherscan' then
        raise exception 'USDT approval requires explicit administrator attestation that the transaction was manually verified on Etherscan' using errcode = '22023';
      end if;
    elsif v_request.provider <> 'bank_transfer' then
      raise exception 'unsupported payment provider' using errcode = '22023';
    end if;
  end if;

  update public.payment_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      admin_note = p_admin_note,
      updated_at = v_now
  where id = v_request.id;

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
          'payment_reference', v_request.reference,
          'payment_provider', v_request.provider
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
          'payment_reference', v_request.reference,
          'payment_provider', v_request.provider
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request.id,
    'decision', p_decision,
    'status', p_decision,
    'business_id', v_request.business_id,
    'plan_code', v_request.plan_code,
    'reviewed_by', auth.uid(),
    'reviewed_at', v_now,
    'payment_provider', v_request.provider
  );
end;
$$;

revoke all on function public.admin_review_payment_request(uuid,text,text) from public;
grant execute on function public.admin_review_payment_request(uuid,text,text) to authenticated;
