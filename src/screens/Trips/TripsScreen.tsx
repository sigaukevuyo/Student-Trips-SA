import { useEffect, useMemo, useState } from "react";

import { dbTripToTrip, tripSelect, type DbCity, type DbTrip } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { TripCard } from "../../shared/components/TripCard";
import type { TripFilters } from "../../App";
import type { View } from "../../shared/navigation";
import "./TripsScreen.css";

export function TripsScreen({
  initialFilters,
  onViewCityTrips,
  setSelectedTrip,
  setView,
}: {
  initialFilters?: TripFilters;
  onViewCityTrips: (trip: Trip) => void;
  setSelectedTrip: (trip: Trip) => void;
  setView: (view: View) => void;
}) {
  const [query, setQuery] = useState(initialFilters?.query ?? "");
  const [city, setCity] = useState(initialFilters?.city ?? "");
  const [category, setCategory] = useState(initialFilters?.category ?? "");
  const [specialCollection, setSpecialCollection] = useState(initialFilters?.specialCollection ?? "");
  const [cities, setCities] = useState<DbCity[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTrips() {
      if (!supabase) {
        setError("We could not load trips right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const [cityResult, tripResult] = await Promise.all([
        supabase.from("cities").select("id,slug,name,province,image_url,tagline,support_email,support_phone").eq("active", true).order("name"),
        supabase.from("trips").select(tripSelect).eq("published", true).order("start_date"),
      ]);

      if (!mounted) return;

      if (cityResult.error || tripResult.error) {
        setError(friendlyError(cityResult.error ?? tripResult.error, "Could not load trips."));
      }

      setCities((cityResult.data as DbCity[] | null) ?? []);
      setTrips(((tripResult.data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setLoading(false);
    }

    loadTrips();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setQuery(initialFilters?.query ?? "");
    setCity(initialFilters?.city ?? "");
    setCategory(initialFilters?.category ?? "");
    setSpecialCollection(initialFilters?.specialCollection ?? "");
  }, [initialFilters?.category, initialFilters?.city, initialFilters?.query, initialFilters?.specialCollection]);

  const categories = useMemo(() => Array.from(new Set(trips.map((trip) => trip.category))).filter(Boolean), [trips]);

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const matchesQuery = `${trip.title} ${trip.summary} ${trip.category}`.toLowerCase().includes(query.toLowerCase());
        const matchesCity = !city || trip.city === city;
        const matchesCategory = !category || trip.category === category;
        const matchesSpecialCollection = !specialCollection || trip.specialCollectionSlug === specialCollection;
        return matchesQuery && matchesCity && matchesCategory && matchesSpecialCollection;
      }),
    [category, city, query, specialCollection, trips],
  );

  return (
    <main className="container page">
      <div className="trips-title">
        <span className="eyebrow dark">{specialCollection ? "Special departures" : "Discover departures"}</span>
        <h1 className="font-display">{initialFilters?.label?.trim() || (specialCollection ? "Special Trips" : "Find your next departure")}</h1>
        <p>{specialCollection ? "Browse the latest highlighted departures and book before spaces fill up." : "Filter by city, style, and availability to compare the trips that fit your budget and dates."}</p>
      </div>

      <section className="card trips-filter-card">
        <label>
          Keyword
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips" />
        </label>
        <label>
          City
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">All cities</option>
            {cities.map((item) => (
              <option key={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Trip type
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All trip types</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {specialCollection ? <span className="trips-result-count">Showing {initialFilters?.label?.trim() || "special trips"}</span> : null}
        <span className="trips-result-count">{filteredTrips.length} trips found</span>
      </section>

      {loading ? <div className="app-empty-state"><ThemeLoader label="Loading trips" /><p>Loading trips...</p></div> : null}
      {error && !loading ? <div className="app-empty-state"><h2>Trips could not load</h2><p>{error}</p></div> : null}
      {!loading && !error && filteredTrips.length === 0 ? <div className="app-empty-state"><h2>No matching trips</h2><p>Try changing your filters or check back soon for new departures.</p></div> : null}

      <div className="trip-grid">
        {filteredTrips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            onViewCityTrips={onViewCityTrips}
            onViewTrip={(selectedTrip) => {
              setSelectedTrip(selectedTrip);
              setView("tripDetail");
            }}
          />
        ))}
      </div>
    </main>
  );
}
