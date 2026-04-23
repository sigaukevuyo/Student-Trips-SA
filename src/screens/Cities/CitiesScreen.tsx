import { useEffect, useState } from "react";

import type { DbCity } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import type { View } from "../../shared/navigation";
import "./CitiesScreen.css";

export type CityDestination = DbCity & {
  tripCount: number;
};

export function CitiesScreen({
  setView,
  setSelectedCity,
}: {
  setView: (view: View) => void;
  setSelectedCity: (city: CityDestination) => void;
}) {
  const [cities, setCities] = useState<CityDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      if (!supabase) {
        setError("We could not load destinations right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("cities")
        .select("id,slug,name,province,image_url,tagline,support_email,support_phone,trips(count)")
        .eq("active", true)
        .order("name");

      if (!mounted) return;

      if (loadError) {
        setError(friendlyError(loadError, "We could not load destinations right now. Please try again."));
      }

      setCities(
        ((data as unknown as DbCity[] | null) ?? []).map((city) => ({
          ...city,
          tripCount: city.trips?.[0]?.count ?? 0,
        })),
      );
      setLoading(false);
    }

    loadCities();

    return () => {
      mounted = false;
    };
  }, []);

  const openCity = (city: CityDestination) => {
    setSelectedCity(city);
    setView("cityDetail");
  };

  return (
    <main className="cities-page">
      <section className="container cities-hero">
        <span className="cities-kicker">City Network</span>
        <h1 className="font-display">Explore Destinations</h1>
        <p>Discover city-based departures and plan where your next group experience starts.</p>
        <div className="cities-count-pill">
          <span>{cities.length} cities</span>
          <i />
          <span>{cities.reduce((sum, city) => sum + city.tripCount, 0)} departures listed</span>
        </div>
      </section>

      {loading ? <div className="container app-empty-state"><ThemeLoader label="Loading cities" /><p>Loading cities...</p></div> : null}
      {error && !loading ? <div className="container app-empty-state"><h2>Destinations could not load</h2><p>{error}</p></div> : null}
      {!loading && !error && cities.length === 0 ? <div className="container app-empty-state"><h2>Destinations are coming soon</h2><p>New city departures are being prepared for upcoming student trips.</p></div> : null}

      <section className="container cities-grid" aria-label="Destination cities">
        {cities.map((city) => (
          <article key={city.id} className="cities-card">
            <div className="cities-card-image">
              {city.image_url ? <img src={city.image_url} alt={`${city.name} destination`} /> : null}
              <div className="cities-card-overlay" />
              <div className="cities-card-top">
                <span>South Africa</span>
                <span>{city.tripCount} trips</span>
              </div>
              <div className="cities-card-copy">
                <span>{city.province}</span>
                <h2 className="font-display">{city.name}</h2>
              </div>
            </div>
            <div className="cities-card-actions">
              <button type="button" onClick={() => openCity(city)}>View city</button>
              <button type="button" onClick={() => openCity(city)}>Browse trips</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
