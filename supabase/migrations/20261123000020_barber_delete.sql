grant delete on public.barbers to authenticated;

create policy club_barbers_delete on public.barbers for delete to authenticated
  using ((select public.is_club_admin()));
