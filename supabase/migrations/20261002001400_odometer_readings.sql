-- 14 · Odometer readings on the Vehicles page
-- vehicles_bundle also returns the latest 100 odometer readings, newest first, so they can be listed,
-- corrected and deleted in the app. Everything else in the function is unchanged from migration 13.

create or replace function public.vehicles_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'vehicles', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.vehicles order by name limit 100) x), '[]'::jsonb),
    'costs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.vehicle_running_costs order by name limit 100) x), '[]'::jsonb),
    'fuel', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.fuel_logs order by filled_at desc limit 100) x), '[]'::jsonb),
    'maintenance', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.maintenance_logs order by performed_on desc limit 100) x), '[]'::jsonb),
    'parking', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.parking_logs order by started_at desc limit 100) x), '[]'::jsonb),
    'odometer', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.odometer_logs order by logged_at desc limit 100) x), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(to_jsonb(x) - 'rn') from (
        select * from (
          select s.*, row_number() over (partition by s.vehicle_id order by s.ended_at desc) as rn
          from public.vehicle_fuel_segments s
        ) ranked
        where ranked.rn <= 12
        order by ranked.vehicle_id, ranked.ended_at desc) x), '[]'::jsonb),
    'latest_services', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select distinct on (m.vehicle_id, m.kind) m.*
        from public.maintenance_logs m
        order by m.vehicle_id, m.kind, m.performed_on desc, m.created_at desc) x), '[]'::jsonb)
  );
$$;
