-- BizGuard V44 runtime repair
-- Apply this one migration if the Admin Portal or Subscription page reports
-- that its database migration is missing. It is intentionally idempotent.

-- =========================
-- ADMIN + PAYMENT FOUNDATION
-- =========================
create or replace function public.is_current_user_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'super_admin');
$$;
revoke all on function public.is_current_user_super_admin() from public;
grant execute on function public.is_current_user_super_admin() to authenticated;

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
create index if not exists payment_requests_status_created_idx on public.payment_requests(status, created_at desc);
create index if not exists payment_requests_business_idx on public.payment_requests(business_id, created_at desc);
alter table public.payment_requests enable row level security;
drop policy if exists payment_requests_admin_read on public.payment_requests;
create policy payment_requests_admin_read on public.payment_requests for select to authenticated using (public.is_current_user_super_admin());
drop policy if exists payment_requests_admin_update on public.payment_requests;
create policy payment_requests_admin_update on public.payment_requests for update to authenticated using (public.is_current_user_super_admin()) with check (public.is_current_user_super_admin());
drop policy if exists payment_requests_owner_insert on public.payment_requests;
create policy payment_requests_owner_insert on public.payment_requests for insert to authenticated
with check (auth.uid() = user_id and exists (select 1 from public.users u where u.id = auth.uid() and u.business_id = payment_requests.business_id));
drop policy if exists payment_requests_owner_read on public.payment_requests;
create policy payment_requests_owner_read on public.payment_requests for select to authenticated using (auth.uid() = user_id or public.is_current_user_super_admin());

create or replace function public.admin_list_users()
returns table (id uuid, email text, name text, business_id uuid, role text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_current_user_super_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  return query select u.id, u.email, u.name, u.business_id, u.role, u.created_at from public.users u order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_review_payment_request(p_request_id uuid, p_decision text, p_admin_note text default null)
returns public.payment_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_request public.payment_requests;
  v_now timestamptz := now();
begin
  if not public.is_current_user_super_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected'; end if;
  select * into v_request from public.payment_requests where id = p_request_id for update;
  if not found then raise exception 'payment request not found'; end if;
  if v_request.status <> 'pending' then return v_request; end if;

  update public.payment_requests
  set status = p_decision, reviewed_by = auth.uid(), reviewed_at = v_now, admin_note = p_admin_note, updated_at = v_now
  where id = p_request_id
  returning * into v_request;

  if p_decision = 'approved' and v_request.business_id is not null then
    if not exists (select 1 from public.subscription_plans where code = v_request.plan_code and is_active = true) then
      raise exception 'subscription plan % is not active', v_request.plan_code;
    end if;
    update public.business_subscriptions
    set plan_code = v_request.plan_code, status = 'active', current_period_started_at = v_now,
        current_period_ends_at = v_now + interval '1 month', provider = v_request.provider,
        metadata = jsonb_build_object('payment_request_id', v_request.id, 'approved_by', auth.uid()), updated_at = v_now
    where business_id = v_request.business_id;
    if not found then
      insert into public.business_subscriptions (business_id, plan_code, status, current_period_started_at, current_period_ends_at, provider, metadata)
      values (v_request.business_id, v_request.plan_code, 'active', v_now, v_now + interval '1 month', v_request.provider,
              jsonb_build_object('payment_request_id', v_request.id, 'approved_by', auth.uid()));
    end if;
  end if;
  return v_request;
end;
$$;
revoke all on function public.admin_review_payment_request(uuid,text,text) from public;
grant execute on function public.admin_review_payment_request(uuid,text,text) to authenticated;

create or replace function public.set_bizguard_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists payment_requests_updated_at on public.payment_requests;
create trigger payment_requests_updated_at before update on public.payment_requests for each row execute function public.set_bizguard_updated_at();

insert into storage.buckets (id, name, public) values ('bizguard-captures','bizguard-captures',false) on conflict (id) do nothing;
drop policy if exists bizguard_captures_insert on storage.objects;
create policy bizguard_captures_insert on storage.objects for insert to authenticated with check (bucket_id = 'bizguard-captures' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists bizguard_captures_select on storage.objects;
create policy bizguard_captures_select on storage.objects for select to authenticated using (bucket_id = 'bizguard-captures' and owner_id = auth.uid());
drop policy if exists bizguard_captures_delete on storage.objects;
create policy bizguard_captures_delete on storage.objects for delete to authenticated using (bucket_id = 'bizguard-captures' and owner_id = auth.uid());

-- =========================
-- SUBSCRIPTION + VOICE FOUNDATION
-- =========================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null,
  monthly_price_ngn numeric(14,2) not null default 0, target_users text[] not null default '{}',
  features jsonb not null default '[]'::jsonb, daily_free_voice_commands integer not null default 0,
  daily_premium_voice_commands integer, daily_total_voice_commands integer, max_products integer,
  max_devices integer, is_unlimited_voice boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists subscription_plans_code_uidx on public.subscription_plans(code);

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  plan_code text not null default 'free', status text not null default 'active', trial_started_at timestamptz,
  trial_ends_at timestamptz, current_period_started_at timestamptz not null default now(), current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false, provider text, provider_customer_id text,
  provider_subscription_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_subscriptions_business_idx on public.business_subscriptions(business_id, updated_at desc);

create table if not exists public.voice_ai_usage (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, usage_date date not null default current_date,
  free_commands_used integer not null default 0, premium_commands_used integer not null default 0,
  total_commands_used integer not null default 0, last_command_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists voice_ai_usage_business_date_uidx on public.voice_ai_usage(business_id, usage_date);

create table if not exists public.voice_ai_commands (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, command_text text not null, normalized_text text,
  intent text not null default 'unknown', parsed_payload jsonb not null default '{}'::jsonb, status text not null default 'processed',
  response_message text, created_at timestamptz not null default now()
);
create index if not exists voice_ai_commands_business_created_idx on public.voice_ai_commands(business_id, created_at desc);

insert into public.subscription_plans (code,name,monthly_price_ngn,target_users,features,daily_free_voice_commands,daily_premium_voice_commands,daily_total_voice_commands,max_products,max_devices,is_unlimited_voice)
values
('free','Free',0,array['Students','Micro Businesses','Market Traders','Startups'],'["Basic Sales Tracking","Basic Inventory Tracking","Basic Debtor Tracking","Daily Revenue Overview","Profit Calculation","Business Health Score","One Device Access","Maximum 50 Products"]'::jsonb,3,0,3,50,1,false),
('starter','Starter',5000,array['Food Vendors','Phone Shops','Fashion Stores','Small Supermarkets'],'["Unlimited Products","WhatsApp Alerts","Debtor Reminders","Smart Restock Suggestions","Expiry Alerts","Export Reports","Multi-device Access (3 Devices)"]'::jsonb,3,5,8,null,3,false),
('pro','Pro',10000,array['Growing Businesses','Pharmacies','Boutiques','Retail Stores'],'["AI Business Doctor","Barcode Scanner","AI Forecasting","Debtor Risk Analysis","Voice-to-Sales","Voice-to-Inventory","Voice-to-Expense","Voice-to-Debtor"]'::jsonb,0,50,50,null,null,false),
('business','Business',25000,array['Schools','Hospitals','Churches','Medium Organizations'],'["Multi-Branch Dashboard","Staff Accounts","Audit Logs","Centralized Reporting","Approval Workflow"]'::jsonb,0,100,100,null,null,false),
('enterprise','Enterprise',100000,array['Manufacturers','Distributors','Franchises','Large Organizations'],'["White Label Version","API Access","Custom AI Models","Dedicated Support","Priority Support","Custom Integrations","Unlimited Voice Commands"]'::jsonb,0,null,null,null,null,true)
on conflict (code) do update set name=excluded.name,monthly_price_ngn=excluded.monthly_price_ngn,target_users=excluded.target_users,features=excluded.features,daily_free_voice_commands=excluded.daily_free_voice_commands,daily_premium_voice_commands=excluded.daily_premium_voice_commands,daily_total_voice_commands=excluded.daily_total_voice_commands,max_products=excluded.max_products,max_devices=excluded.max_devices,is_unlimited_voice=excluded.is_unlimited_voice,is_active=true,updated_at=now();

insert into public.business_subscriptions (business_id,plan_code,status,current_period_started_at,metadata)
select b.id,'free','active',now(),jsonb_build_object('source','bizguard_runtime_repair') from public.businesses b
where not exists (select 1 from public.business_subscriptions s where s.business_id=b.id);

create or replace function public.user_can_access_business(target_business_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.users u where u.id=auth.uid() and (u.role='super_admin' or u.business_id=target_business_id)); $$;
grant execute on function public.user_can_access_business(uuid) to authenticated;

create or replace function public.get_business_subscription(target_business_id uuid)
returns table (business_id uuid,plan_code text,plan_name text,status text,monthly_price_ngn numeric,daily_free_voice_commands integer,daily_premium_voice_commands integer,daily_total_voice_commands integer,is_unlimited_voice boolean,max_products integer,max_devices integer,current_period_ends_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.user_can_access_business(target_business_id) then raise exception 'business access required' using errcode='42501'; end if;
  return query select target_business_id,p.code,p.name,coalesce(s.status,'active'),p.monthly_price_ngn,p.daily_free_voice_commands,p.daily_premium_voice_commands,p.daily_total_voice_commands,p.is_unlimited_voice,p.max_products,p.max_devices,s.current_period_ends_at
  from public.subscription_plans p left join lateral (select bs.* from public.business_subscriptions bs where bs.business_id=target_business_id order by bs.updated_at desc,bs.created_at desc limit 1) s on true
  where p.code=coalesce(s.plan_code,'free') and p.is_active=true limit 1;
end; $$;
grant execute on function public.get_business_subscription(uuid) to authenticated;

create or replace function public.get_voice_ai_usage_status(target_business_id uuid)
returns table (business_id uuid,plan_code text,plan_name text,used_today integer,remaining_today integer,daily_limit integer,is_unlimited boolean,reset_at timestamptz,upgrade_message text)
language plpgsql stable security definer set search_path=public as $$
declare v_plan record; v_used integer:=0; v_reset timestamptz:=date_trunc('day',now() at time zone 'UTC')+interval '1 day';
begin
  if not public.user_can_access_business(target_business_id) then raise exception 'business access required' using errcode='42501'; end if;
  select * into v_plan from public.get_business_subscription(target_business_id) limit 1;
  if not found then raise exception 'subscription plan unavailable'; end if;
  select coalesce(total_commands_used,0) into v_used from public.voice_ai_usage where business_id=target_business_id and usage_date=current_date limit 1;
  return query select target_business_id,v_plan.plan_code,v_plan.plan_name,v_used,case when v_plan.is_unlimited_voice then null else greatest(v_plan.daily_total_voice_commands-v_used,0) end,v_plan.daily_total_voice_commands,v_plan.is_unlimited_voice,v_reset,
  case when v_plan.is_unlimited_voice then 'Unlimited Voice AI enabled.' when greatest(v_plan.daily_total_voice_commands-v_used,0)=0 then 'You have reached today''s Voice AI limit. Upgrade to continue.' else 'Voice AI available.' end;
end; $$;
grant execute on function public.get_voice_ai_usage_status(uuid) to authenticated;

create or replace function public.record_voice_ai_command(target_business_id uuid,command_text text)
returns table (allowed boolean,plan_code text,used_today integer,remaining_today integer,daily_limit integer,is_unlimited boolean,message text,parsed_payload jsonb)
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_plan record; v_usage public.voice_ai_usage; v_text text:=lower(trim(command_text)); v_intent text:='unknown'; v_payload jsonb; v_limit integer; v_total integer:=0; v_allowed boolean:=true; v_message text;
begin
  if v_user is null or not public.user_can_access_business(target_business_id) then raise exception 'business access required' using errcode='42501'; end if;
  select * into v_plan from public.get_business_subscription(target_business_id) limit 1;
  if not found then raise exception 'subscription plan unavailable'; end if;
  if v_text like '%sale%' or v_text like '%sold%' or v_text like '%sell%' then v_intent:='sale'; elsif v_text like '%stock%' or v_text like '%inventory%' or v_text like '%restock%' then v_intent:='inventory'; elsif v_text like '%debt%' or v_text like '%debtor%' or v_text like '%owe%' then v_intent:='debtor'; elsif v_text like '%expense%' or v_text like '%spent%' or v_text like '%spend%' then v_intent:='expense'; elsif v_text like '%report%' or v_text like '%revenue%' or v_text like '%profit%' then v_intent:='report'; elsif v_text like '%risk%' then v_intent:='risk'; elsif v_text like '%opportun%' then v_intent:='opportunity'; elsif v_text like '%forecast%' or v_text like '%predict%' then v_intent:='prediction'; end if;
  v_payload:=jsonb_build_object('intent',v_intent,'normalized_text',v_text,'confidence',case when v_intent='unknown' then 0.35 else 0.8 end);
  insert into public.voice_ai_usage(business_id,user_id,usage_date) values(target_business_id,v_user,current_date) on conflict(business_id,usage_date) do nothing;
  select * into v_usage from public.voice_ai_usage where business_id=target_business_id and usage_date=current_date for update;
  v_limit:=v_plan.daily_total_voice_commands;
  if not v_plan.is_unlimited_voice and v_usage.total_commands_used>=v_limit then v_allowed:=false; v_message:='You have reached today''s Voice AI limit. Upgrade to continue.';
  else
    if v_plan.code='free' or v_usage.free_commands_used<coalesce(v_plan.daily_free_voice_commands,0) then update public.voice_ai_usage set free_commands_used=free_commands_used+1,total_commands_used=total_commands_used+1,last_command_at=now(),updated_at=now() where id=v_usage.id;
    else update public.voice_ai_usage set premium_commands_used=premium_commands_used+1,total_commands_used=total_commands_used+1,last_command_at=now(),updated_at=now() where id=v_usage.id; end if;
    insert into public.voice_ai_commands(business_id,user_id,command_text,normalized_text,intent,parsed_payload,status,response_message) values(target_business_id,v_user,command_text,v_text,v_intent,v_payload,'processed','Voice command accepted.');
    v_message:='Voice command accepted.';
  end if;
  select coalesce(total_commands_used,0) into v_total from public.voice_ai_usage where id=v_usage.id;
  return query select v_allowed,v_plan.plan_code,v_total,case when v_plan.is_unlimited_voice then null else greatest(v_plan.daily_total_voice_commands-v_total,0) end,v_plan.daily_total_voice_commands,v_plan.is_unlimited_voice,v_message,v_payload;
end; $$;
grant execute on function public.record_voice_ai_command(uuid,text) to authenticated;

create or replace function public.change_business_subscription(target_business_id uuid,target_plan_code text,target_provider text default 'manual')
returns public.business_subscriptions language plpgsql security definer set search_path=public as $$
declare v_row public.business_subscriptions; v_admin boolean:=public.is_current_user_super_admin();
begin
  if not public.user_can_access_business(target_business_id) then raise exception 'business access required' using errcode='42501'; end if;
  if not exists(select 1 from public.subscription_plans where code=target_plan_code and is_active=true) then raise exception 'subscription plan % is not active',target_plan_code; end if;
  if target_plan_code<>'free' and not v_admin then raise exception 'paid plans require administrator approval' using errcode='42501'; end if;
  update public.business_subscriptions set plan_code=target_plan_code,status='active',provider=target_provider,current_period_started_at=now(),current_period_ends_at=case when target_plan_code='free' then null else now()+interval '1 month' end,updated_at=now() where business_id=target_business_id;
  if not found then insert into public.business_subscriptions(business_id,plan_code,status,provider,current_period_started_at,current_period_ends_at) values(target_business_id,target_plan_code,'active',target_provider,now(),case when target_plan_code='free' then null else now()+interval '1 month' end) returning * into v_row;
  else select * into v_row from public.business_subscriptions where business_id=target_business_id order by updated_at desc limit 1; end if;
  return v_row;
end; $$;
grant execute on function public.change_business_subscription(uuid,text,text) to authenticated;

create or replace function public.set_subscription_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists subscription_plans_updated_at on public.subscription_plans;
create trigger subscription_plans_updated_at before update on public.subscription_plans for each row execute function public.set_subscription_updated_at();
drop trigger if exists business_subscriptions_updated_at on public.business_subscriptions;
create trigger business_subscriptions_updated_at before update on public.business_subscriptions for each row execute function public.set_subscription_updated_at();
drop trigger if exists voice_ai_usage_updated_at on public.voice_ai_usage;
create trigger voice_ai_usage_updated_at before update on public.voice_ai_usage for each row execute function public.set_subscription_updated_at();

alter table public.subscription_plans enable row level security;
drop policy if exists subscription_plans_read on public.subscription_plans;
create policy subscription_plans_read on public.subscription_plans for select to authenticated using(is_active=true);
alter table public.business_subscriptions enable row level security;
drop policy if exists business_subscriptions_read on public.business_subscriptions;
create policy business_subscriptions_read on public.business_subscriptions for select to authenticated using(public.user_can_access_business(business_id));
alter table public.voice_ai_usage enable row level security;
drop policy if exists voice_ai_usage_read on public.voice_ai_usage;
create policy voice_ai_usage_read on public.voice_ai_usage for select to authenticated using(public.user_can_access_business(business_id));
alter table public.voice_ai_commands enable row level security;
drop policy if exists voice_ai_commands_read on public.voice_ai_commands;
create policy voice_ai_commands_read on public.voice_ai_commands for select to authenticated using(public.user_can_access_business(business_id));
