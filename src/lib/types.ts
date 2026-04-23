export type TripStatus = "OPEN" | "NEARLY_FULL" | "SOLD_OUT" | "DRAFT" | "ARCHIVED";

export type Trip = {
  id: string;
  slug: string;
  title: string;
  city: string;
  category: string;
  image: string;
  startDate: string;
  duration: string;
  price: number;
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
