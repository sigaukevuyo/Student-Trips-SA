import { CalendarCheck, Globe2, MapPin, Search, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { dbTripToTrip, getTodayIsoDate, tripSelect, type DbCity, type DbTrip } from "../../lib/db";
import { useCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/data";
import { friendlyError } from "../../lib/friendlyError";
import { usePricing } from "../../lib/pricing";
import { supabase } from "../../lib/supabase";
import { getTripBadges } from "../../lib/tripBadges";
import type { Trip } from "../../lib/types";
import { Button } from "../../shared/components/Button";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import type { TripFilters } from "../../App";
import type { View } from "../../shared/navigation";
import "./HomeScreen.css";

type Review = {
  id: string;
  quote: string;
  author_name: string;
  rating: number;
};

type HomeUpdate = {
  id: string;
  title: string;
  body: string;
  banner_special_collection_slug: string | null;
};

const values = [
  { title: "Deposit-first booking", body: "Reserve your seat without paying full upfront on eligible departures.", icon: CalendarCheck },
  { title: "Verified guides", body: "Experienced teams and guide coordination every step with clear support.", icon: ShieldCheck },
  { title: "City network support", body: "Local branch teams manage city trips, departure logistics, and updates.", icon: Globe2 },
  { title: "Student-friendly group energy", body: "Experiences designed for students who want social travel made simple.", icon: Users },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="home-stars" aria-label={`${rating} star review`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={13} fill="currentColor" className={index >= rating ? "faded" : ""} />
      ))}
    </div>
  );
}

export function HomeScreen({
  onTripSearch,
  onViewCityTrips,
  setSelectedTrip,
  setView,
}: {
  onTripSearch: (filters: TripFilters) => void;
  onViewCityTrips: (trip: Trip) => void;
  setSelectedTrip: (trip: Trip) => void;
  setView: (view: View) => void;
}) {
  const { formatTripMoney, priceNotice } = useCurrency();
  const { resolveTripPricing } = usePricing();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [cities, setCities] = useState<(DbCity & { tripCount: number })[]>([]);
  const [featuredTrips, setFeaturedTrips] = useState<Trip[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<HomeUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadHomeData() {
      if (!supabase) {
        setError("We could not load the latest trip highlights right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const [cityResult, tripResult, reviewResult, updateResult] = await Promise.all([
        supabase.from("cities").select("id,slug,name,province,image_url,tagline,support_email,support_phone,trips(count)").eq("active", true).order("name").limit(6),
        supabase.from("trips").select(tripSelect).eq("published", true).gte("start_date", getTodayIsoDate()).order("created_at", { ascending: false }).limit(3),
        supabase.from("reviews").select("id,quote,author_name,rating").eq("published", true).order("created_at", { ascending: false }).limit(6),
        supabase.from("updates").select("id,title,body,banner_special_collection_slug").eq("published", true).order("published_on", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (!mounted) return;

      if (cityResult.error || tripResult.error || reviewResult.error || updateResult.error) {
        setError(friendlyError(cityResult.error ?? tripResult.error ?? reviewResult.error ?? updateResult.error, "Could not load home content."));
      }

      setCities(((cityResult.data as unknown as DbCity[] | null) ?? []).map((city) => ({ ...city, tripCount: city.trips?.[0]?.count ?? 0 })));
      setFeaturedTrips(((tripResult.data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setReviews((reviewResult.data as Review[] | null) ?? []);
      setLatestUpdate((updateResult.data as HomeUpdate | null) ?? null);
      setLoading(false);
    }

    loadHomeData();

    return () => {
      mounted = false;
    };
  }, []);

  function exploreDepartures() {
    onTripSearch({
      query: searchQuery.trim(),
      city: searchCity,
      category: searchCategory,
    });
    setView("trips");
  }

  function openSpecialTrips() {
    if (!latestUpdate?.banner_special_collection_slug) return;

    onTripSearch({
      specialCollection: latestUpdate.banner_special_collection_slug,
      label: latestUpdate.title.trim() || "Special trips",
    });
    setView("trips");
  }

  return (
    <>
      {latestUpdate?.body ? (
        <button
          className="home-announcement"
          type="button"
          aria-label={latestUpdate.banner_special_collection_slug ? `Open ${latestUpdate.title || "special"} trips` : "Latest update"}
          onClick={openSpecialTrips}
          disabled={!latestUpdate.banner_special_collection_slug}
        >
          <div className="home-announcement-track">
            {Array.from({ length: 8 }).map((_, index) => (
              <span key={index} aria-hidden={index > 0}>
                {latestUpdate.body}
              </span>
            ))}
          </div>
        </button>
      ) : null}

      <section className="home-hero">
        <img src="/assets/Hero Img.jpeg" alt="Students enjoying a group trip" />
        <div className="home-hero-overlay" />
        <div className="container home-hero-content">
          <span className="home-hero-chip">Student Trips SA</span>
          <h1 className="font-display">Group experiences for 18-35s</h1>
          <p>Student travel across South Africa with clear pricing, trusted guides, and simple booking.</p>
          <div className="home-hero-actions">
            <Button onClick={() => setView("trips")}>Explore Trips</Button>
            <Button variant="secondary" onClick={() => setView("cities")}>
              Browse Cities
            </Button>
          </div>
        </div>
      </section>

      <section className="container home-search-panel">
        <span>Discover faster</span>
        <h2 className="font-display">Start with the trip style that matches your crew</h2>
        <p>Search by city and trip type, then save or book in a few clicks.</p>
        <div className="home-search-grid">
          <label>
            Search destination, vibe, or trip name
            <div className="input-icon">
              <Search size={15} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") exploreDepartures();
              }} placeholder="Search destination, vibe, or trip name" />
            </div>
          </label>
          <label>
            City
            <select value={searchCity} onChange={(event) => setSearchCity(event.target.value)}>
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <label>
            Trip type
            <select value={searchCategory} onChange={(event) => setSearchCategory(event.target.value)}>
              <option value="">All trip types</option>
              {Array.from(new Set(featuredTrips.map((trip) => trip.category))).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <Button onClick={exploreDepartures}>Explore Departures</Button>
        </div>
      </section>

      {loading ? <div className="container app-empty-state"><ThemeLoader label="Loading home" /><p>Loading home...</p></div> : null}
      {error && !loading ? <div className="container app-empty-state"><h2>Something went wrong</h2><p>{error}</p></div> : null}

      <section className="home-section container">
        <div className="home-section-title">
          <h2 className="font-display">Discover trips by vibe and demand</h2>
          <p>Browse what is trending now, what is nearly sold out, and what just launched.</p>
        </div>

        <div className="home-row-title">
          <h3 className="font-display">Featured right now</h3>
          <button type="button" onClick={() => setView("trips")}>View all featured</button>
        </div>

        {featuredTrips.length === 0 && !loading ? <div className="app-empty-state"><h2>New departures are coming soon</h2><p>Check back shortly for featured student trips and weekend escapes.</p></div> : null}

        <div className="home-featured-grid">
          {featuredTrips.map((trip) => {
            const pricing = resolveTripPricing(trip);
            return (
              <article className="home-trip-card" key={trip.id}>
              <div className="home-trip-art">
                {trip.image ? <img src={trip.image} alt={`${trip.title} destination`} /> : null}
                <div className="home-trip-badges">
                  {getTripBadges(trip).map((badge) => (
                    <span key={badge}><Sparkles size={15} />{badge}</span>
                  ))}
                </div>
                <div className="home-trip-overlay-bottom">
                  <div>
                    <span className="home-trip-status">{trip.status === "SOLD_OUT" ? "Sold Out" : trip.status === "NEARLY_FULL" ? "Nearly Full" : "Open"}</span>
                    <strong>{trip.category}</strong>
                  </div>
                </div>
              </div>
              <div className="home-trip-body">
                <div className="home-trip-meta">
                  <span><MapPin size={15} />{trip.city}</span>
                  <span>{trip.category}</span>
                </div>
                <h4 className="font-display">{trip.title}</h4>
                <p>{trip.summary}</p>
                <div className="home-trip-facts">
                  <span>{formatDate(trip.startDate)}</span>
                  <span>{trip.seatsRemaining} seats left</span>
                  <strong className="home-trip-price-stack">
                    {pricing.comparePrice ? <span>{formatTripMoney(pricing.comparePrice)}</span> : null}
                    <em>From {formatTripMoney(pricing.price)}</em>
                  </strong>
                  <strong>Deposit {formatTripMoney(pricing.deposit)}</strong>
                </div>
                <p className="home-trip-currency">{priceNotice}</p>
                <div className="home-trip-actions">
                  <button type="button" onClick={() => {
                    setSelectedTrip(trip);
                    setView("tripDetail");
                  }}>View Trip</button>
                  <button type="button" onClick={() => onViewCityTrips(trip)}>See city trips</button>
                </div>
              </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-section container">
        <div className="home-row-title">
          <h2 className="font-display">Explore by City</h2>
          <button type="button" onClick={() => setView("cities")}>See all cities</button>
        </div>
        {cities.length === 0 && !loading ? <div className="app-empty-state"><h2>Destinations are being prepared</h2><p>Our next city departures will be listed here soon.</p></div> : null}
        <div className="home-city-grid">
          {cities.map((city) => (
            <article key={city.id} className="home-city-card">
              <div className="home-city-image">
                {city.image_url ? <img src={city.image_url} alt={`${city.name} skyline`} /> : null}
                <div className="home-city-overlay" />
                <div className="home-city-top">
                  <span>South Africa</span>
                  <span>{city.tripCount} trips</span>
                </div>
                <div className="home-city-copy">
                  <span>{city.province}</span>
                  <h3 className="font-display">{city.name}</h3>
                </div>
              </div>
              <div className="home-city-actions">
                <button type="button" onClick={() => setView("cities")}>View city</button>
                <button type="button" onClick={() => setView("cities")}>Browse trips</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-band">
        <div className="container">
          <div className="home-section-title">
            <h2 className="font-display">Why travel with Student Trips SA</h2>
            <p>Built for social travel with trusted pricing and support from booking to return.</p>
          </div>
          <div className="home-value-grid">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <article className="home-value-card" key={item.title}>
                  <span><Icon size={18} /></span>
                  <h3 className="font-display">{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section container">
        <div className="home-row-title"><h2 className="font-display">Customer Reviews</h2></div>
        {reviews.length === 0 && !loading ? <div className="app-empty-state"><h2>Student stories coming soon</h2><p>Reviews from recent travelers will be shared here once available.</p></div> : null}
        <div className="home-review-grid">
          {reviews.map((review) => (
            <article className="home-review-card" key={review.id}>
              <Stars rating={review.rating} />
              <p>{review.quote}</p>
              <strong>{review.author_name}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
