alter table public.barbers
  add column endereco text,
  add constraint barbers_address_length check (char_length(btrim(endereco)) between 1 and 240);

grant insert (endereco), update (endereco) on public.barbers to authenticated;

create policy club_barbers_update_address on public.barbers for update to authenticated
  using ((select public.is_club_admin()))
  with check ((select public.is_club_admin()));
