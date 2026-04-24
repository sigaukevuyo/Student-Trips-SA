create table if not exists public.archived_trips (
  id uuid primary key,
  city_id uuid,
  slug text not null,
  title text not null,
  category text not null,
  image_url text,
  summary text,
  meeting_point text,
  start_date date not null,
  end_date date,
  duration text,
  price_cents integer not null,
  community_price_cents integer,
  non_community_price_cents integer,
  original_price_cents integer,
  deposit_cents integer not null default 0,
  capacity integer not null,
  seats_remaining integer not null,
  status public.trip_status not null,
  featured boolean not null default false,
  tags text[] not null default '{}'::text[],
  published boolean not null default true,
  pickup_points text[] not null default '{}'::text[],
  is_special boolean not null default false,
  special_collection_slug text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists archived_trips_start_date_idx on public.archived_trips(start_date desc);
create index if not exists archived_trips_city_id_idx on public.archived_trips(city_id);
create index if not exists archived_trips_archived_at_idx on public.archived_trips(archived_at desc);

create or replace function public.archive_past_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer := 0;
begin
  insert into public.archived_trips (
    id,
    city_id,
    slug,
    title,
    category,
    image_url,
    summary,
    meeting_point,
    start_date,
    end_date,
    duration,
    price_cents,
    community_price_cents,
    non_community_price_cents,
    original_price_cents,
    deposit_cents,
    capacity,
    seats_remaining,
    status,
    featured,
    tags,
    published,
    pickup_points,
    is_special,
    special_collection_slug,
    created_at,
    updated_at,
    archived_at
  )
  select
    t.id,
    t.city_id,
    t.slug,
    t.title,
    t.category,
    t.image_url,
    t.summary,
    t.meeting_point,
    t.start_date,
    t.end_date,
    t.duration,
    t.price_cents,
    t.community_price_cents,
    t.non_community_price_cents,
    t.original_price_cents,
    t.deposit_cents,
    t.capacity,
    t.seats_remaining,
    t.status,
    t.featured,
    t.tags,
    t.published,
    t.pickup_points,
    t.is_special,
    t.special_collection_slug,
    t.created_at,
    t.updated_at,
    now()
  from public.trips t
  where t.start_date < current_date
    and not exists (
      select 1
      from public.archived_trips a
      where a.id = t.id
    );

  get diagnostics archived_count = row_count;

  delete from public.trips
  where start_date < current_date;

  return archived_count;
end;
$$;
