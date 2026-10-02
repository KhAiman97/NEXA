-- 05 · Vehicle & Logistics
-- Costs live on the log rows; transaction_id optionally links the matching ledger entry.

create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                text not null,
  make                text,
  model               text,
  year                smallint check (year between 1950 and 2100),
  plate_number        text,
  fuel_type           text not null default 'ron95'
                        check (fuel_type in ('ron95', 'ron97', 'diesel', 'hybrid', 'ev', 'other')),
  tank_capacity_l     numeric(6, 2) check (tank_capacity_l > 0),
  initial_odometer_km integer not null default 0 check (initial_odometer_km >= 0),
  purchased_on        date,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, id)
);

create table public.odometer_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id  uuid not null,
  logged_at   timestamptz not null default now(),
  odometer_km integer not null check (odometer_km >= 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade
);

create table public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id      uuid not null,
  filled_at       timestamptz not null default now(),
  odometer_km     integer not null check (odometer_km >= 0),
  liters          numeric(8, 3) not null check (liters > 0),
  price_per_liter numeric(8, 3) not null check (price_per_liter >= 0),
  total_cost      numeric(12, 2) not null check (total_cost >= 0),
  is_full_tank    boolean not null default true,
  station         text,
  fuel_grade      text,
  transaction_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create table public.maintenance_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id       uuid not null,
  performed_on     date not null default current_date,
  odometer_km      integer check (odometer_km >= 0),
  kind             text not null default 'service'
                     check (kind in (
                       'service', 'oil_change', 'tyres', 'brakes', 'battery', 'repair',
                       'inspection', 'road_tax', 'insurance', 'accessories', 'other'
                     )),
  description      text,
  workshop         text,
  cost             numeric(12, 2) not null default 0 check (cost >= 0),
  next_due_km      integer check (next_due_km >= 0),
  next_due_on      date,
  transaction_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

-- Municipal parking history.
create table public.parking_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id     uuid not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  authority      text,            -- e.g. municipal council
  location       text,
  zone           text,
  payment_method text,            -- coupon, app, meter, ...
  cost           numeric(12, 2) not null default 0 check (cost >= 0),
  transaction_id uuid,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create index on public.odometer_logs (user_id, vehicle_id, logged_at desc);
create index on public.fuel_logs (user_id, vehicle_id, filled_at desc);
create index on public.fuel_logs (user_id, transaction_id) where transaction_id is not null;
create index on public.maintenance_logs (user_id, vehicle_id, performed_on desc);
create index on public.maintenance_logs (user_id, transaction_id) where transaction_id is not null;
create index on public.parking_logs (user_id, vehicle_id, started_at desc);
create index on public.parking_logs (user_id, transaction_id) where transaction_id is not null;

alter table public.vehicles enable row level security;
create policy "Users see own data" on public.vehicles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.odometer_logs enable row level security;
create policy "Users see own data" on public.odometer_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.fuel_logs enable row level security;
create policy "Users see own data" on public.fuel_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.maintenance_logs enable row level security;
create policy "Users see own data" on public.maintenance_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.parking_logs enable row level security;
create policy "Users see own data" on public.parking_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- views

-- Full-tank method. A segment runs from one full fill to the next full fill; partial fills
-- in between add to its liters. Segment k = rows that have exactly k full fills before them.
-- Segment 0 has no known starting point, and a segment with no closing full fill is incomplete.
create view public.vehicle_fuel_segments with (security_invoker = true) as
with ordered as (
  select
    f.*,
    count(*) filter (where f.is_full_tank) over (
      partition by f.vehicle_id
      order by f.odometer_km, f.filled_at
      rows between unbounded preceding and 1 preceding
    ) as prior_full
  from public.fuel_logs f
),
fulls as (
  select
    vehicle_id,
    odometer_km,
    row_number() over (partition by vehicle_id order by odometer_km, filled_at) as rn
  from public.fuel_logs
  where is_full_tank
),
segments as (
  select
    o.user_id,
    o.vehicle_id,
    s.odometer_km                 as start_odometer_km,
    max(o.odometer_km)            as end_odometer_km,
    max(o.filled_at)              as ended_at,
    sum(o.liters)                 as liters,
    sum(o.total_cost)             as cost
  from ordered o
  join fulls s on s.vehicle_id = o.vehicle_id and s.rn = o.prior_full
  where o.prior_full >= 1
  group by o.user_id, o.vehicle_id, o.prior_full, s.odometer_km
  having bool_or(o.is_full_tank)
)
select
  user_id,
  vehicle_id,
  start_odometer_km,
  end_odometer_km,
  ended_at,
  end_odometer_km - start_odometer_km                                                 as distance_km,
  liters,
  cost,
  round((end_odometer_km - start_odometer_km) / nullif(liters, 0), 2)                 as km_per_liter,
  round(liters * 100 / nullif(end_odometer_km - start_odometer_km, 0), 2)             as liters_per_100km,
  round(cost / nullif(end_odometer_km - start_odometer_km, 0), 3)                     as fuel_cost_per_km
from segments;

-- Lifetime running cost per vehicle. Distance = highest odometer seen anywhere - initial odometer.
create view public.vehicle_running_costs with (security_invoker = true) as
select
  v.user_id,
  v.id as vehicle_id,
  v.name,
  coalesce(f.cost, 0)                                                         as fuel_cost,
  coalesce(m.cost, 0)                                                         as maintenance_cost,
  coalesce(p.cost, 0)                                                         as parking_cost,
  coalesce(f.cost, 0) + coalesce(m.cost, 0) + coalesce(p.cost, 0)             as total_cost,
  greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo)            as current_odometer_km,
  greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo)
    - v.initial_odometer_km                                                   as distance_km,
  round(
    (coalesce(f.cost, 0) + coalesce(m.cost, 0) + coalesce(p.cost, 0))
    / nullif(greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo) - v.initial_odometer_km, 0)
  , 3)                                                                        as cost_per_km
from public.vehicles v
left join (select vehicle_id, sum(total_cost) as cost, max(odometer_km) as max_odo
           from public.fuel_logs group by vehicle_id) f on f.vehicle_id = v.id
left join (select vehicle_id, sum(cost) as cost, max(odometer_km) as max_odo
           from public.maintenance_logs group by vehicle_id) m on m.vehicle_id = v.id
left join (select vehicle_id, sum(cost) as cost
           from public.parking_logs group by vehicle_id) p on p.vehicle_id = v.id
left join (select vehicle_id, max(odometer_km) as max_odo
           from public.odometer_logs group by vehicle_id) o on o.vehicle_id = v.id;
