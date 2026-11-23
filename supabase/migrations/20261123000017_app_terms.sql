begin;

create or replace function public.create_client_on_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  accepted_version text := coalesce(new.raw_user_meta_data ->> 'app_terms_version', new.raw_user_meta_data ->> 'consent_version');
begin
  if (new.raw_user_meta_data -> 'consent_terms') is distinct from 'true'::jsonb
    or nullif(btrim(new.phone), '') is null
    or accepted_version is null
    or accepted_version not in ('2026-11-21-phone-preview', '2026-11-23-termos')
  then
    raise exception 'Celular e aceite dos Termos de Uso da Aplicação obrigatórios.' using errcode = '23514';
  end if;

  insert into public.clients (id, nome, avatar_skin, consent_terms, consent_terms_at, consent_version)
  values (
    new.id, btrim(new.raw_user_meta_data ->> 'nome'),
    new.raw_user_meta_data ->> 'avatar_skin', true, statement_timestamp(), accepted_version
  );
  return new;
end;
$$;

create function public.get_app_terms_version()
returns text language sql immutable set search_path = ''
as $$ select '2026-11-23-termos'::text $$;

revoke all on function public.get_app_terms_version() from public, anon, authenticated;
grant execute on function public.get_app_terms_version() to anon, authenticated;

commit;
