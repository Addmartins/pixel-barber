begin;

create table public.partner_barbershops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create index partner_barbershops_owner_id_idx on public.partner_barbershops (owner_id);
alter table public.partner_barbershops enable row level security;
revoke all on public.partner_barbershops from public, anon, authenticated;
grant select, update (name) on public.partner_barbershops to authenticated;
create policy partner_barbershops_owner_read on public.partner_barbershops
  for select to authenticated using (owner_id = (select auth.uid()));
create policy partner_barbershops_owner_update on public.partner_barbershops
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table club_private.partner_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.clients(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  barbershop_id uuid unique references public.partner_barbershops(id) on delete restrict
);
alter table club_private.partner_invites enable row level security;
revoke all on club_private.partner_invites from public, anon, authenticated;
create index partner_invites_owner_id_idx on club_private.partner_invites (owner_id);

create function public.create_partner_invite(p_phone text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  invitee uuid;
  invite_id uuid;
begin
  if not public.is_club_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select u.id into invitee
  from auth.users u join public.clients c on c.id = u.id
  where ltrim(u.phone, '+') = ltrim(p_phone, '+') and u.phone_confirmed_at is not null;
  if invitee is null then
    raise sqlstate 'PT404' using message = 'Conta com celular confirmado não encontrada.';
  end if;
  insert into club_private.partner_invites (owner_id) values (invitee) returning id into invite_id;
  return invite_id;
end;
$$;

create function public.accept_partner_invite(p_invite_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  invite club_private.partner_invites%rowtype;
  shop_id uuid;
begin
  select * into invite from club_private.partner_invites
  where id = p_invite_id and owner_id = auth.uid() for update;
  if not found then
    raise sqlstate 'PT404' using message = 'Convite indisponível para esta conta.';
  end if;
  if invite.barbershop_id is not null then return invite.barbershop_id; end if;
  if invite.expires_at <= statement_timestamp() then
    raise sqlstate 'PT410' using message = 'Convite expirado.';
  end if;
  insert into public.partner_barbershops (owner_id, name)
  values (invite.owner_id, btrim(p_name)) returning id into shop_id;
  update club_private.partner_invites set barbershop_id = shop_id where id = invite.id;
  return shop_id;
end;
$$;

revoke all on function public.create_partner_invite(text), public.accept_partner_invite(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_partner_invite(text), public.accept_partner_invite(uuid, text)
  to authenticated;

commit;
