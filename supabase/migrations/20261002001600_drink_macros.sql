-- 16 · Drinks carry their protein, carbs and fat too
-- So a teh tarik's milk and sugar count toward the day's macros, not only its energy. daily_hydration gains
-- the three totals (appended). Drinks already logged from the drink menu get their figures by name.

alter table public.hydration_logs
  add column if not exists protein_g numeric(8, 2) not null default 0 check (protein_g >= 0),
  add column if not exists carbs_g   numeric(8, 2) not null default 0 check (carbs_g >= 0),
  add column if not exists fat_g     numeric(8, 2) not null default 0 check (fat_g >= 0);

create or replace view public.daily_hydration with (security_invoker = true) as
select
  h.user_id,
  (h.logged_at at time zone p.timezone)::date as day,
  sum(h.volume_ml)    as total_volume_ml,
  sum(h.caffeine_mg)  as total_caffeine_mg,
  count(*)            as drinks,
  sum(h.calories)     as total_calories,
  sum(h.protein_g)    as total_protein_g,
  sum(h.carbs_g)      as total_carbs_g,
  sum(h.fat_g)        as total_fat_g
from public.hydration_logs h
join public.profiles p on p.id = h.user_id
group by h.user_id, 2;

-- Figures from the drink menu (lib/app/malaysian-foods.ts) for drinks logged before this change.
update public.hydration_logs h
set protein_g = m.protein_g, carbs_g = m.carbs_g, fat_g = m.fat_g
from (values
    ('Teh tarik', 4, 26, 5),
    ('Teh ais', 4, 28, 5),
    ('Teh O panas', 0, 10, 0),
    ('Teh O ais limau', 0, 23, 0),
    ('Teh halia', 4, 25, 4),
    ('Kopi O', 0.5, 15, 0),
    ('Kopi (with susu pekat)', 3, 22, 4),
    ('Kopi ais', 3, 23, 4),
    ('Nescafe ais', 3, 30, 4),
    ('Nescafe O ais', 0.5, 17, 0),
    ('Nescafe tarik', 4, 24, 4),
    ('Aiman''s Coffee (decaf)', 4, 6.4, 2.2),
    ('Milo ais', 5, 34, 5),
    ('Milo panas', 5, 30, 4.5),
    ('Neslo ais', 5, 33, 5),
    ('Horlicks ais', 5, 34, 5),
    ('Sirap bandung', 3, 34, 4),
    ('Limau ais', 0, 26, 0),
    ('Air kelapa', 0.5, 11, 0.5),
    ('Air soya', 6, 18, 4),
    ('Barli ais', 1, 29, 0),
    ('Air mata kucing', 0.5, 27, 0),
    ('Air cincau', 0.5, 29, 0.5),
    ('100PLUS', 0, 21, 0),
    ('Coca-Cola', 0, 35, 0)
) as m(beverage, protein_g, carbs_g, fat_g)
where h.beverage = m.beverage and h.protein_g = 0 and h.carbs_g = 0 and h.fat_g = 0;
