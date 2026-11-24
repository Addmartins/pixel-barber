-- Run on a migrated test database. Fixtures are rolled back.
begin;
do $$
declare
  admin_id uuid := gen_random_uuid();
  requester_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  meta jsonb := '{"nome":"Cliente Teste","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (admin_id, '5581777700061', meta),
    (requester_id, '5581777700062', meta),
    (other_id, '5581777700063', meta);
  insert into public.club_admins values (admin_id);
  perform public.post_points(requester_id, 100, 'CORTE', 'Fixture ranking', 'fixture-access-rank');

  perform set_config('request.jwt.claim.sub', requester_id::text, true);
  set local role authenticated;
  if not public.request_club_access() or not public.request_club_access() then
    raise exception 'Solicitação falhou';
  end if;
  if not public.has_pending_club_access_request() or public.has_club_access()
    or exists (select from public.get_leaderboard()) or exists (select from public.barbers) then
    raise exception 'Solicitação duplicada, ausente ou com liberação indevida';
  end if;
  begin
    perform public.approve_club_access(requester_id);
    raise exception 'Cliente aprovou o próprio acesso';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_club_access_requests();
    raise exception 'Cliente consultou a fila administrativa';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  if public.has_pending_club_access_request() then raise exception 'Pedido de outro cliente ficou visível'; end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if public.approve_club_access(other_id)
    or (select count(*) from public.get_club_access_requests()) <> 1
    or not exists (select from public.get_club_access_requests()
      where user_id = requester_id and phone_ending = '0062') then
    raise exception 'Fila ou validação de solicitação do administrador incorreta';
  end if;
  if not public.approve_club_access(requester_id) or not public.approve_club_access(requester_id) then
    raise exception 'Falha ao aprovar';
  end if;
  if exists (select from public.get_club_access_requests()) then
    raise exception 'Pedido aprovado permaneceu na fila';
  end if;

  perform set_config('request.jwt.claim.sub', requester_id::text, true);
  if public.has_pending_club_access_request() or not public.has_club_access()
    or public.request_club_access()
    or not exists (select from public.get_leaderboard() where points_balance = 100) then
    raise exception 'O cliente aprovado não ganhou acesso ao ranking ou continuou com pedido aberto';
  end if;
  if has_function_privilege('anon', 'public.request_club_access()', 'EXECUTE') then
    raise exception 'Sessão anônima pode solicitar acesso';
  end if;
  reset role;
end;
$$;
rollback;
