begin;

create table if not exists public.barbershop_location (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Pixel Barber',
  city text not null default 'João Pessoa / PB',
  latitude double precision not null default -7.1195,
  longitude double precision not null default -34.8450,
  radius_km double precision not null default 60.0,
  updated_at timestamptz not null default now()
);

alter table public.barbershop_location enable row level security;
revoke all on public.barbershop_location from public, anon, authenticated;

insert into public.barbershop_location (id, name, city, latitude, longitude, radius_km)
values (1, 'Pixel Barber', 'João Pessoa / PB', -7.1195, -34.8450, 60.0)
on conflict (id) do nothing;

create or replace function public.get_barbershop_location()
returns table (city text, latitude double precision, longitude double precision, radius_km double precision)
language sql stable security definer set search_path = ''
as $$
  select city, latitude, longitude, radius_km from public.barbershop_location where id = 1;
$$;

revoke all on function public.get_barbershop_location() from public, anon, authenticated;
grant execute on function public.get_barbershop_location() to anon, authenticated;

create or replace function public.update_barbershop_location(
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then
    raise exception 'Apenas administradores podem configurar a localização.' using errcode = '42501';
  end if;

  update public.barbershop_location
  set city = btrim(p_city),
      latitude = p_latitude,
      longitude = p_longitude,
      radius_km = p_radius_km,
      updated_at = now()
  where id = 1;

  return true;
end;
$$;

revoke all on function public.update_barbershop_location(text, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.update_barbershop_location(text, double precision, double precision, double precision) to authenticated;

create or replace function public.verify_location_access(p_lat double precision, p_lng double precision)
returns table (granted boolean, distance_km double precision, city text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_loc record;
  v_dist double precision;
  v_rad_lat1 double precision;
  v_rad_lat2 double precision;
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
  v_c double precision;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select * into v_loc from public.barbershop_location where id = 1;
  if not found then
    insert into public.barbershop_location (id) values (1) returning * into v_loc;
  end if;

  -- Fórmula Haversine para cálculo de distância em km
  v_rad_lat1 := radians(p_lat);
  v_rad_lat2 := radians(v_loc.latitude);
  v_dlat := radians(v_loc.latitude - p_lat);
  v_dlng := radians(v_loc.longitude - p_lng);

  v_a := sin(v_dlat / 2.0)^2 + cos(v_rad_lat1) * cos(v_rad_lat2) * sin(v_dlng / 2.0)^2;
  v_c := 2.0 * atan2(sqrt(v_a), sqrt(1.0 - v_a));
  v_dist := 6371.0 * v_c;

  if v_dist <= v_loc.radius_km then
    insert into public.club_members (user_id) values (v_user_id)
    on conflict (user_id) do nothing;
    return query select true, round(v_dist::numeric, 1)::double precision, v_loc.city;
  else
    return query select false, round(v_dist::numeric, 1)::double precision, v_loc.city;
  end if;
end;
$$;

revoke all on function public.verify_location_access(double precision, double precision) from public, anon, authenticated;
grant execute on function public.verify_location_access(double precision, double precision) to authenticated;

commit;
