begin;

create table public.club_access_requests (
  user_id uuid primary key references public.clients(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.club_access_requests enable row level security;
revoke all on public.club_access_requests from public, anon, authenticated;

create function public.has_pending_club_access_request()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.club_access_requests where user_id = (select auth.uid()));
$$;

create function public.request_club_access()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  requester uuid := auth.uid();
begin
  perform 1 from public.clients where id = requester for no key update;
  if not found then raise exception 'Conta indisponível.' using errcode = '42501'; end if;
  if public.has_club_access() then return false; end if;
  insert into public.club_access_requests (user_id) values (requester) on conflict do nothing;
  return true;
end;
$$;

create function public.get_club_access_requests()
returns table (user_id uuid, nome text, phone_ending text, requested_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query
    select r.user_id, c.nome, right(nullif(u.phone, ''), 4), r.requested_at
    from public.club_access_requests r
    join public.clients c on c.id = r.user_id
    join auth.users u on u.id = r.user_id
    order by r.requested_at, r.user_id
    limit 20;
end;
$$;

create function public.approve_club_access(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  perform 1 from public.clients where id = p_user_id for no key update;
  delete from public.club_access_requests where user_id = p_user_id;
  if not found then
    return exists (select 1 from public.club_members where user_id = p_user_id);
  end if;
  insert into public.club_members (user_id) values (p_user_id) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.has_pending_club_access_request(), public.request_club_access(),
  public.get_club_access_requests(), public.approve_club_access(uuid) from public, anon, authenticated;
grant execute on function public.has_pending_club_access_request(), public.request_club_access(),
  public.get_club_access_requests(), public.approve_club_access(uuid) to authenticated;

commit;
