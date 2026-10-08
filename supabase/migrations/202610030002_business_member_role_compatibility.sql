-- BizGuard auth/profile repair compatibility fix.
-- The canonical public.users role vocabulary is broader than the legacy
-- business_members role constraint. Never copy an enterprise profile role
-- directly into business_members.
-- Supported business_members roles remain: owner, manager, staff.

-- Normalize any legacy invalid membership roles before the constraint/function
-- is exercised again. Only existing membership rows are touched.
update public.business_members
set role = case
  when role in ('business_owner', 'super_admin', 'owner') then 'owner'
  when role in ('manager', 'staff') then role
  else 'owner'
end
where role not in ('owner', 'manager', 'staff');

-- Make profile repair idempotent and role-safe. This replaces the previous
-- implementation that passed public.users.role directly into business_members.
create or replace function public.ensure_user_profile_for_auth_user(
  p_user_id uuid,
  p_business_id text default null,
  p_name text default null,
  p_business_name text default null,
  p_industry text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user record;
  resolved_business_id uuid;
  resolved_name text;
  existing_by_email public.users%rowtype;
  profile public.users%rowtype;
  member_role text;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  select id, email, raw_user_meta_data
    into auth_user
  from auth.users
  where id = p_user_id;

  if auth_user.id is null then
    raise exception 'Auth user % was not found', p_user_id;
  end if;

  resolved_name := coalesce(
    nullif(btrim(p_name), ''),
    nullif(btrim(auth_user.raw_user_meta_data->>'name'), ''),
    split_part(auth_user.email, '@', 1),
    'Business Owner'
  );

  resolved_business_id := public.resolve_profile_business_id(
    p_business_id,
    coalesce(nullif(btrim(p_business_name), ''), nullif(btrim(auth_user.raw_user_meta_data->>'business_name'), '')),
    coalesce(nullif(btrim(p_industry), ''), nullif(btrim(auth_user.raw_user_meta_data->>'industry'), 'Retail'))
  );

  select * into existing_by_email
  from public.users
  where email = auth_user.email
    and id <> auth_user.id
  limit 1;

  if existing_by_email.id is not null then
    update public.users
       set id = auth_user.id,
           name = coalesce(nullif(name, ''), resolved_name),
           business_id = coalesce(business_id, resolved_business_id),
           role = coalesce(nullif(role, ''), 'owner')
     where id = existing_by_email.id
     returning * into profile;
  else
    insert into public.users (id, email, name, business_id, role)
    values (auth_user.id, auth_user.email, resolved_name, resolved_business_id, 'owner')
    on conflict (id) do update
      set email = excluded.email,
          name = coalesce(nullif(public.users.name, ''), excluded.name),
          business_id = coalesce(public.users.business_id, excluded.business_id),
          role = coalesce(nullif(public.users.role, ''), excluded.role)
    returning * into profile;
  end if;

  if profile.business_id is not null then
    -- business_members intentionally has a narrower role vocabulary than
    -- public.users. Preserve the user's profile role without violating the
    -- membership constraint.
    member_role := case
      when coalesce(nullif(profile.role, ''), 'owner') in ('manager', 'staff') then profile.role
      else 'owner'
    end;

    insert into public.business_members (business_id, user_id, role, status)
    values (profile.business_id, auth_user.id, member_role, 'active')
    on conflict (business_id, user_id) do update
      set role = case
        when public.business_members.role in ('owner', 'manager', 'staff')
          then public.business_members.role
        else excluded.role
      end,
      status = 'active';
  end if;

  return profile;
end;
$$;

grant execute on function public.ensure_user_profile_for_auth_user(uuid, text, text, text, text) to authenticated;

create or replace function public.ensure_user_profile(
  p_business_id text default null,
  p_name text default null,
  p_business_name text default null,
  p_industry text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return public.ensure_user_profile_for_auth_user(
    auth.uid(),
    p_business_id,
    p_name,
    p_business_name,
    p_industry
  );
end;
$$;

grant execute on function public.ensure_user_profile(text, text, text, text) to authenticated;
