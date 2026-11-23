begin;

create function public.grant_signup_points()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.phone_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.phone_confirmed_at is not null then return new; end if;

  perform public.post_points(new.id, 150, 'LOGIN', 'Crédito de boas-vindas', 'signup-welcome');
  return new;
end;
$$;

revoke all on function public.grant_signup_points() from public, anon, authenticated;

-- Runs after create_pixel_barber_client if confirmation occurs during insertion.
create trigger grant_signup_points
after insert or update of phone_confirmed_at on auth.users
for each row execute function public.grant_signup_points();

commit;
