export type TripStatus = "OPEN" | "NEARLY_FULL" | "SOLD_OUT" | "DRAFT" | "ARCHIVED";

export type Trip = {
  id: string;
  slug: string;
  title: string;
  cityId: string | null;
  citySlug: string | null;
  city: string;
  category: string;
  image: string;
  startDate: string;
  duration: string;
  price: number;
  communityPrice: number | null;
  nonCommunityPrice: number | null;
  originalPrice: number | null;
  deposit: number;
  seatsRemaining: number;
  capacity: number;
  status: TripStatus;
  isSpecial: boolean;
  specialCollectionSlug: string | null;
  featured?: boolean;
  tags: string[];
  summary: string;
  meetingPoint: string;
  pickupPoints: string[];
};

export type CityPickupPoint = {
  id: string;
  cityId: string;
  area: string;
  point: string;
  sortOrder: number;
};

export type Booking = {
  id: string;
  ref: string;
  tripTitle: string;
  city: string;
  date: string;
  status: "Confirmed" | "Pending Payment" | "Awaiting Proof";
  outstanding: number;
};

export type City = {
  slug: string;
  name: string;
  image: string;
  tagline: string;
  tripCount: number;
};
