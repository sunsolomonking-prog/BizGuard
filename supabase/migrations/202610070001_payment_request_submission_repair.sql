-- BizGuard targeted repair: payment request submission.
-- LOCKED TARGET: fix failures after receipt upload when Continue creates the payment request.
-- Additive only. Preserves plans, payment account, Admin Portal, subscriptions, AI, and Snap Count.

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
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_business_id is null then raise exception 'business workspace is required'; end if;

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
  if p_amount_ngn is null or p_amount_ngn <> v_plan.monthly_price_ngn then raise exception 'payment amount does not match the selected plan'; end if;
  if coalesce(p_provider, '') <> 'bank_transfer' then raise exception 'unsupported payment provider'; end if;
  if p_proof_url is null or length(trim(p_proof_url)) = 0 then raise exception 'payment proof is required'; end if;
  if split_part(p_proof_url, '/', 1) <> v_user_id::text then raise exception 'payment proof ownership could not be verified'; end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'bizguard-captures'
      and o.name = p_proof_url
      and o.owner_id = v_user_id::text
  ) then raise exception 'payment proof upload could not be verified'; end if;

  select * into v_existing from public.payment_requests
  where business_id = p_business_id and status = 'pending'
  order by created_at desc limit 1 for update;

  if found then return v_existing; end if;

  insert into public.payment_requests (
    business_id, user_id, plan_code, amount_ngn, provider, reference, proof_url, note, status
  ) values (
    p_business_id, v_user_id, p_plan_code, p_amount_ngn, 'bank_transfer',
    nullif(trim(p_reference), ''), p_proof_url, nullif(trim(p_note), ''), 'pending'
  ) returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.create_payment_request(uuid,text,numeric,text,text,text,text) from public;
grant execute on function public.create_payment_request(uuid,text,numeric,text,text,text,text) to authenticated;
