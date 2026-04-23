import { useEffect, useState } from "react";

import { dbTripToTrip, tripSelect, type DbTrip } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { TripCard } from "../../shared/components/TripCard";
import type { View } from "../../shared/navigation";
import type { CityDestination } from "./CitiesScreen";
import "./CityDetailScreen.css";

export function CityDetailScreen({
  city,
  setSelectedTrip,
  setView,
}: {
  city: CityDestination | null;
  setSelectedTrip: (trip: Trip) => void;
  setView: (view: View) => void;
}) {
  const [cityTrips, setCityTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(Boolean(city));
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCityTrips() {
      if (!city) {
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError("We could not load trips for this city right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("trips")
        .select(tripSelect)
        .eq("city_id", city.id)
        .eq("published", true)
        .order("start_date");

      if (!mounted) return;

      if (loadError) {
        setError(friendlyError(loadError, "We could not load trips for this city right now. Please try again."));
      }

      setCityTrips(((data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setLoading(false);
    }

    loadCityTrips();

    return () => {
      mounted = false;
    };
  }, [city]);

  if (!city) {
    return (
      <main className="city-detail-page">
        <div className="container app-empty-state">
          <h2>Select a city</h2>
          <p>Choose a city from the destinations page to see its departures.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="city-detail-page">
      <section className="container city-detail-hero">
        {city.image_url ? <img src={city.image_url} alt={`${city.name} city view`} /> : null}
        <div className="city-detail-hero-overlay" />
        <div className="city-detail-hero-copy">
          <span>{city.province}</span>
          <h1 className="font-display">{city.name}</h1>
          <p>{city.tagline || `Explore departures from ${city.name}.`}</p>
          <small>
            {[city.support_email, city.support_phone].filter(Boolean).join(" | ")}
          </small>
        </div>
      </section>

      <section className="container city-detail-info-grid">
        <article className="city-detail-info-card">
          <h2>Trips from {city.name}</h2>
          <p>Local departures and nationally visible trips from this city team.</p>
        </article>

        <article className="city-detail-info-card city-detail-partnership-card">
          <h2>Need a private group trip?</h2>
          <p>We support university societies, student councils, and private departures.</p>
          <button type="button">Contact partnerships</button>
        </article>
      </section>

      {loading ? <div className="container app-empty-state"><ThemeLoader label="Loading city trips" /><p>Loading city trips...</p></div> : null}
      {error && !loading ? <div className="container app-empty-state"><h2>Trips could not load</h2><p>{error}</p></div> : null}
      {!loading && !error && cityTrips.length === 0 ? <div className="container app-empty-state"><h2>No current departures for {city.name}</h2><p>Check back soon for new student trips from this city.</p></div> : null}

      <section className="container city-detail-trip-grid" aria-label={`Trips from ${city.name}`}>
        {cityTrips.map((trip) => (
          <TripCard key={trip.id} trip={trip} hideCityAction onViewTrip={(selectedTrip) => {
            setSelectedTrip(selectedTrip);
            setView("tripDetail");
          }} />
        ))}
      </section>
    </main>
  );
}
