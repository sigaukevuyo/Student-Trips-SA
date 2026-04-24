with selected_city as (
  select id
  from public.cities
  where slug = 'gqeberha'
  limit 1
)
insert into public.city_pickup_points (
  city_id,
  area,
  point,
  sort_order,
  active
)
select
  selected_city.id,
  seed.area,
  seed.point,
  seed.sort_order,
  true
from selected_city
cross join (
  values
    ('Humewood', 'MC Donald''s', 10),
    ('Summerstrand', 'SSV', 20),
    ('Summerstrand', 'SPAR', 21),
    ('Summerstrand', '2nd Avenue Campus', 22),
    ('Summerstrand', 'Dunes', 23),
    ('Town', 'Feathermarket', 30),
    ('Town', 'Laboria Accommodation', 31),
    ('Central', 'Suites of Cape', 40),
    ('Central', 'Donkin Park', 41),
    ('Walmer', 'Moffat on Main at KFC', 50),
    ('Greenacres & Newton Park', 'Greenacres Checkers Entrance', 60),
    ('North End', 'Pier 14 Mall', 70),
    ('North End', 'Home Affairs', 71),
    ('North End', 'The Law Court', 72)
) as seed(area, point, sort_order)
on conflict (city_id, area, point) do update
set
  sort_order = excluded.sort_order,
  active = excluded.active;
