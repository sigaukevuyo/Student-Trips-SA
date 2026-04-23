import type { Trip } from "./types";

export type DbCity = {
  id: string;
  slug: string;
  name: string;
  province: string | null;
  image_url: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  trips?: { count: number }[] | null;
};

export type DbTrip = {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  summary: string | null;
  meeting_point: string | null;
  pickup_points: string[] | null;
  start_date: string;
  duration: string | null;
  price_cents: number;
  original_price_cents: number | null;
  deposit_cents: number;
  seats_remaining: number;
  capacity: number;
  status: Trip["status"];
  is_special: boolean | null;
  special_collection_slug: string | null;
  featured: boolean | null;
  tags: string[] | null;
  cities?: { name: string | null } | null;
};

export function deriveTripStatus(capacity: number, seatsRemaining: number): Trip["status"] {
  if (capacity <= 0) return "SOLD_OUT";

  const remaining = Math.max(seatsRemaining, 0);
  const booked = Math.max(capacity - remaining, 0);
  const bookedRatio = booked / capacity;

  if (remaining === 0 || booked >= capacity) return "SOLD_OUT";
  if (bookedRatio >= 0.8) return "NEARLY_FULL";
  return "OPEN";
}

export function dbTripToTrip(trip: DbTrip): Trip {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    city: trip.cities?.name ?? "South Africa",
    category: trip.category,
    image: trip.image_url ?? "",
    startDate: trip.start_date,
    duration: trip.duration ?? "",
    price: trip.price_cents,
    originalPrice: trip.original_price_cents,
    deposit: trip.deposit_cents,
    seatsRemaining: trip.seats_remaining,
    capacity: trip.capacity,
    status: deriveTripStatus(trip.capacity, trip.seats_remaining),
    isSpecial: Boolean(trip.is_special),
    specialCollectionSlug: trip.special_collection_slug ?? null,
    featured: Boolean(trip.featured),
    tags: trip.tags ?? [],
    summary: trip.summary ?? "",
    meetingPoint: trip.meeting_point ?? "",
    pickupPoints: trip.pickup_points?.length ? trip.pickup_points : [trip.meeting_point].filter((point): point is string => Boolean(point)),
  };
}

export const tripSelect =
  "id,slug,title,category,image_url,summary,meeting_point,pickup_points,start_date,duration,price_cents,original_price_cents,deposit_cents,seats_remaining,capacity,status,is_special,special_collection_slug,featured,tags,cities(name)";
