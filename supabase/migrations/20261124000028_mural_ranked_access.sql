begin;

-- Garante acesso público/autenticado a barbeiros, serviços e produtos da loja
grant select on public.barbers, public.services, public.store_products to authenticated, anon;
alter policy barbers_read on public.barbers to authenticated, anon using (true);
alter policy services_read on public.services to authenticated, anon using (true);
alter policy products_read on public.store_products to authenticated, anon using (true);

-- Permite agendamentos e compra de cosméticos sem restrição de acesso ao clube
create or replace function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, available boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  return query select * from club_private.get_available_slots(p_barber_id, p_service_id, p_date);
end;
$$;

create or replace function public.create_appointment(p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  return club_private.create_appointment(p_barber_id, p_service_id, p_starts_at);
end;
$$;

create or replace function public.buy_avatar_item(p_product_id uuid)
returns table (points_balance integer)
language plpgsql security definer set search_path = ''
as $$
begin
  return query select * from club_private.buy_avatar_item(p_product_id);
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, date),
  public.create_appointment(uuid, uuid, timestamptz),
  public.buy_avatar_item(uuid) from public, anon, authenticated;

grant execute on function public.get_available_slots(uuid, uuid, date),
  public.create_appointment(uuid, uuid, timestamptz),
  public.buy_avatar_item(uuid) to authenticated;

commit;
