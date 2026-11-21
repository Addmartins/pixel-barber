begin;

create or replace function public.create_client_on_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.raw_user_meta_data -> 'consent_terms') is distinct from 'true'::jsonb
    or nullif(btrim(new.phone), '') is null
    or (new.raw_user_meta_data ->> 'consent_version') is distinct from '2026-11-21-phone-preview'
  then
    raise exception 'Celular e aceite dos termos e da política obrigatórios.' using errcode = '23514';
  end if;

  insert into public.clients (id, nome, avatar_skin, consent_terms, consent_terms_at, consent_version)
  values (
    new.id, btrim(new.raw_user_meta_data ->> 'nome'),
    new.raw_user_meta_data ->> 'avatar_skin', true, statement_timestamp(), '2026-11-21-phone-preview'
  );
  return new;
end;
$$;

commit;
