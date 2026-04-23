-- Student Trips SA Supabase schema
-- Run this in the Supabase SQL editor after creating your project.
-- Prices are stored in cents, for example R3 499.00 = 349900.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('customer', 'branch', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.trip_status as enum ('OPEN', 'NEARLY_FULL', 'SOLD_OUT', 'DRAFT', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('Pending Payment', 'Awaiting Proof', 'Confirmed', 'Waitlisted', 'Cancelled', 'Refund Pending', 'Refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('Pending', 'Paid', 'Failed', 'Refund Pending', 'Refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('card', 'eft', 'manual', 'deposit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inquiry_type as enum ('Partner', 'Campus', 'Society', 'Ambassador', 'Contact');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  first_name text,
  last_name text,
  phone text,
  email text,
  avatar_url text,
  campus text,
  date_of_birth date,
  gender text,
  id_passport_number text,
  student_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  dietary_requirements text,
  medical_notes text,
  organisation text,
  profile_complete_percent integer not null default 0 check (profile_complete_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists id_passport_number text;
alter table public.profiles add column if not exists student_number text;
alter table public.profiles add column if not exists emergency_contact_name text;
alter table public.profiles add column if not exists emergency_contact_phone text;
alter table public.profiles add column if not exists dietary_requirements text;
alter table public.profiles add column if not exists medical_notes text;

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_assignment record;
begin
  select *
  into branch_assignment
  from public.branch_manager_assignments
  where email = lower(new.email)
    and active = true
  limit 1;

  insert into public.profiles (id, email, role, branch_city_id, first_name, last_name, phone, organisation)
  values (
    new.id,
    new.email,
    case when branch_assignment.id is not null then 'branch'::public.user_role else 'customer'::public.user_role end,
    branch_assignment.branch_city_id,
    coalesce(new.raw_user_meta_data ->> 'first_name', branch_assignment.first_name),
    coalesce(new.raw_user_meta_data ->> 'last_name', branch_assignment.last_name),
    coalesce(new.raw_user_meta_data ->> 'phone', branch_assignment.phone),
    branch_assignment.organisation
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case when branch_assignment.id is not null then 'branch'::public.user_role else public.profiles.role end,
    branch_city_id = coalesce(branch_assignment.branch_city_id, public.profiles.branch_city_id),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    organisation = coalesce(public.profiles.organisation, excluded.organisation);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  province text,
  image_url text,
  tagline text,
  support_email text,
  support_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists branch_city_id uuid references public.cities(id) on delete set null;
create index if not exists profiles_branch_city_id_idx on public.profiles(branch_city_id);

create table if not exists public.branch_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  branch_city_id uuid not null references public.cities(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  organisation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branch_manager_assignments_branch_city_id_idx on public.branch_manager_assignments(branch_city_id);

create or replace trigger branch_manager_assignments_set_updated_at
before update on public.branch_manager_assignments
for each row execute function public.set_updated_at();

create or replace trigger cities_set_updated_at
before update on public.cities
for each row execute function public.set_updated_at();

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id) on delete set null,
  slug text not null unique,
  title text not null,
  category text not null,
  image_url text,
  summary text,
  meeting_point text,
  pickup_points text[] not null default '{}',
  start_date date not null,
  end_date date,
  duration text,
  price_cents integer not null check (price_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  capacity integer not null check (capacity > 0),
  seats_remaining integer not null check (seats_remaining >= 0),
  status public.trip_status not null default 'OPEN',
  featured boolean not null default false,
  tags text[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_city_id_idx on public.trips(city_id);
create index if not exists trips_start_date_idx on public.trips(start_date);
create index if not exists trips_status_idx on public.trips(status);

alter table public.trips add column if not exists pickup_points text[] not null default '{}';

create or replace trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete restrict,
  status public.booking_status not null default 'Pending Payment',
  traveler_first_name text,
  traveler_last_name text,
  traveler_email text,
  traveler_phone text,
  total_cents integer not null check (total_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  outstanding_cents integer generated always as (greatest(total_cents - paid_cents, 0)) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_trip_id_idx on public.bookings(trip_id);
create index if not exists bookings_status_idx on public.bookings(status);

create or replace trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'Pending',
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_booking_id_idx on public.payments(booking_id);
create index if not exists payments_user_id_idx on public.payments(user_id);

create or replace trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime_type text,
  amount_cents integer check (amount_cents >= 0),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  approved boolean,
  created_at timestamptz not null default now()
);

create index if not exists payment_proofs_booking_id_idx on public.payment_proofs(booking_id);
create index if not exists payment_proofs_user_id_idx on public.payment_proofs(user_id);

create table if not exists public.waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  waiver_version text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (booking_id, waiver_version)
);

create index if not exists waiver_acceptances_user_id_idx on public.waiver_acceptances(user_id);

create table if not exists public.saved_trips (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);

create table if not exists public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_type public.inquiry_type not null default 'Partner',
  name text not null,
  email text not null,
  phone text,
  organisation text,
  campus text,
  preferred_city text,
  details text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  phone text,
  subject text,
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_on date not null default current_date,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger updates_set_updated_at
before update on public.updates
for each row execute function public.set_updated_at();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  author_name text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  quote text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'branch'), false)
$$;

create or replace function public.current_branch_city_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_city_id from public.profiles where id = auth.uid()
$$;

create or replace function public.can_access_trip(trip_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.trips t
      where t.id = trip_id_param
        and t.city_id = public.current_branch_city_id()
    ),
    false
  )
$$;

create or replace function public.can_access_booking(booking_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      where b.id = booking_id_param
        and t.city_id = public.current_branch_city_id()
    ),
    false
  )
$$;

create or replace function public.cancel_booking(booking_id_param uuid)
returns public.booking_status
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row record;
  next_status public.booking_status;
begin
  select
    b.id,
    b.user_id,
    b.status,
    b.paid_cents,
    t.start_date
  into booking_row
  from public.bookings b
  join public.trips t on t.id = b.trip_id
  where b.id = booking_id_param;

  if booking_row.id is null or booking_row.user_id <> auth.uid() then
    raise exception 'Booking not found.';
  end if;

  if booking_row.status in ('Cancelled', 'Refund Pending', 'Refunded') then
    return booking_row.status;
  end if;

  if booking_row.status in ('Pending Payment', 'Awaiting Proof', 'Waitlisted') then
    next_status := 'Cancelled';
  elsif booking_row.status = 'Confirmed' then
    if current_date > (booking_row.start_date - 7) then
      raise exception 'Confirmed bookings can only be cancelled at least 7 days before the trip date.';
    end if;

    next_status := case
      when coalesce(booking_row.paid_cents, 0) > 0 then 'Refund Pending'::public.booking_status
      else 'Cancelled'::public.booking_status
    end;
  else
    raise exception 'This booking cannot be cancelled.';
  end if;

  update public.bookings
  set status = next_status
  where id = booking_id_param;

  return next_status;
end;
$$;

grant execute on function public.cancel_booking(uuid) to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be logged in to delete your account.';
  end if;

  delete from auth.users
  where id = current_user_id;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "payment proof files upload own folder" on storage.objects;
create policy "payment proof files upload own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "payment proof files read own or staff" on storage.objects;
create policy "payment proof files read own or staff"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
  )
);

alter table public.profiles enable row level security;
alter table public.branch_manager_assignments enable row level security;
alter table public.cities enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.waiver_acceptances enable row level security;
alter table public.saved_trips enable row level security;
alter table public.partner_inquiries enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.updates enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "profiles read own or staff" on public.profiles;
create policy "profiles read own or staff"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "branch manager assignments admin manage" on public.branch_manager_assignments;
create policy "branch manager assignments admin manage"
on public.branch_manager_assignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "cities public read active" on public.cities;
create policy "cities public read active"
on public.cities for select
to anon, authenticated
using (active = true or public.is_staff());

drop policy if exists "cities staff manage" on public.cities;
create policy "cities staff manage"
on public.cities for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "trips public read published" on public.trips;
create policy "trips public read published"
on public.trips for select
to anon, authenticated
using (published = true or public.is_staff());

drop policy if exists "trips staff manage" on public.trips;
create policy "trips staff manage"
on public.trips for all
to authenticated
using (public.is_admin() or city_id = public.current_branch_city_id())
with check (public.is_admin() or city_id = public.current_branch_city_id());

drop policy if exists "bookings read own or staff" on public.bookings;
create policy "bookings read own or staff"
on public.bookings for select
to authenticated
using (user_id = auth.uid() or public.can_access_booking(id));

drop policy if exists "bookings create own" on public.bookings;
create policy "bookings create own"
on public.bookings for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "bookings update own limited or staff" on public.bookings;
drop policy if exists "bookings staff update" on public.bookings;
create policy "bookings staff update"
on public.bookings for update
to authenticated
using (public.can_access_booking(id))
with check (public.can_access_booking(id));

drop policy if exists "payments read own or staff" on public.payments;
create policy "payments read own or staff"
on public.payments for select
to authenticated
using (user_id = auth.uid() or public.can_access_booking(booking_id));

drop policy if exists "payments create own" on public.payments;
create policy "payments create own"
on public.payments for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "payments staff update" on public.payments;
create policy "payments staff update"
on public.payments for update
to authenticated
using (public.can_access_booking(booking_id))
with check (public.can_access_booking(booking_id));

drop policy if exists "payment proofs read own or staff" on public.payment_proofs;
create policy "payment proofs read own or staff"
on public.payment_proofs for select
to authenticated
using (user_id = auth.uid() or public.can_access_booking(booking_id));

drop policy if exists "payment proofs create own" on public.payment_proofs;
create policy "payment proofs create own"
on public.payment_proofs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "payment proofs staff update" on public.payment_proofs;
create policy "payment proofs staff update"
on public.payment_proofs for update
to authenticated
using (public.can_access_booking(booking_id))
with check (public.can_access_booking(booking_id));

drop policy if exists "waivers read own or staff" on public.waiver_acceptances;
create policy "waivers read own or staff"
on public.waiver_acceptances for select
to authenticated
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "waivers create own" on public.waiver_acceptances;
create policy "waivers create own"
on public.waiver_acceptances for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "saved trips own read" on public.saved_trips;
create policy "saved trips own read"
on public.saved_trips for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "saved trips own manage" on public.saved_trips;
create policy "saved trips own manage"
on public.saved_trips for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "partner inquiries create public" on public.partner_inquiries;
create policy "partner inquiries create public"
on public.partner_inquiries for insert
to anon, authenticated
with check (true);

drop policy if exists "partner inquiries staff read" on public.partner_inquiries;
create policy "partner inquiries staff read"
on public.partner_inquiries for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.cities c
    where c.id = public.current_branch_city_id()
      and c.name = preferred_city
  )
);

drop policy if exists "contact inquiries create public" on public.contact_inquiries;
create policy "contact inquiries create public"
on public.contact_inquiries for insert
to anon, authenticated
with check (true);

drop policy if exists "contact inquiries staff read" on public.contact_inquiries;
create policy "contact inquiries staff read"
on public.contact_inquiries for select
to authenticated
using (public.is_staff());

drop policy if exists "updates public read published" on public.updates;
create policy "updates public read published"
on public.updates for select
to anon, authenticated
using (published = true or public.is_staff());

drop policy if exists "updates staff manage" on public.updates;
create policy "updates staff manage"
on public.updates for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "reviews public read published" on public.reviews;
create policy "reviews public read published"
on public.reviews for select
to anon, authenticated
using (published = true or public.is_staff());

drop policy if exists "reviews authenticated create" on public.reviews;
create policy "reviews authenticated create"
on public.reviews for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "reviews staff manage" on public.reviews;
create policy "reviews staff manage"
on public.reviews for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

insert into public.cities (slug, name, province, image_url, tagline, support_email, support_phone)
values
  ('cape-town', 'Cape Town', 'Western Cape', 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1200&q=80', 'Coastlines, mountains, markets, and big group energy.', 'cpt@studenttrips.co.za', '+27 79 707 5710'),
  ('durban', 'Durban', 'KwaZulu-Natal', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Warm beaches, food stops, and relaxed weekend escapes.', 'dbn@studenttrips.co.za', '+27 79 707 5710'),
  ('johannesburg', 'Johannesburg', 'Gauteng', 'https://images.unsplash.com/photo-1576485375217-d6a95e34d043?auto=format&fit=crop&w=1200&q=80', 'Culture, nightlife, history, and day-trip departures.', 'jhb@studenttrips.co.za', '+27 79 707 5710')
on conflict (slug) do nothing;

insert into public.trips (
  city_id, slug, title, category, image_url, summary, meeting_point, start_date, duration,
  price_cents, deposit_cents, capacity, seats_remaining, status, featured, tags
)
select c.id, seed.slug, seed.title, seed.category, seed.image_url, seed.summary, seed.meeting_point, seed.start_date::date, seed.duration,
  seed.price_cents, seed.deposit_cents, seed.capacity, seed.seats_remaining, seed.status::public.trip_status, seed.featured, seed.tags
from (
  values
    ('cape-town', 'cape-town-coastal-weekender', 'Cape Town Coastal Weekender', 'Weekend Trip', 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80', 'A social coastal escape with beaches, viewpoints, food markets, and safe group transport.', 'Cape Town Station', '2026-06-12', '3 days', 349900, 49900, 18, 4, 'NEARLY_FULL', true, array['Popular', 'Limited seats']),
    ('durban', 'durban-beach-break', 'Durban Beach Break', 'Adventure', 'https://images.unsplash.com/photo-1603366615917-1fa6dad5c4fa?auto=format&fit=crop&w=1200&q=80', 'Surf, promenade walks, group dinners, and enough free time to make the weekend your own.', 'Durban ICC', '2026-07-04', '2 days', 219900, 39900, 20, 9, 'OPEN', false, array['New']),
    ('johannesburg', 'joburg-culture-crawl', 'Joburg Culture Crawl', 'Learning Experience', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80', 'Museums, local food, creative districts, and guided context for curious student groups.', 'Park Station', '2026-05-23', '1 day', 89900, 19900, 24, 12, 'OPEN', false, array['Featured'])
) as seed(city_slug, slug, title, category, image_url, summary, meeting_point, start_date, duration, price_cents, deposit_cents, capacity, seats_remaining, status, featured, tags)
join public.cities c on c.slug = seed.city_slug
on conflict (slug) do nothing;
