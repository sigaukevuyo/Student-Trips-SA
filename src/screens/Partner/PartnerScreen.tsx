import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import "./PartnerScreen.css";

const supportItems = [
  "Private departures and society-specific packages",
  "Campus campaign and ambassador referral setup",
  "City-level operations and manifest coordination",
  "Deposit-first booking models for student affordability",
];

export function PartnerScreen() {
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      if (!supabase) {
        return;
      }

      const { data } = await supabase.from("cities").select("name").eq("active", true).order("name");

      if (mounted) {
        setCities(((data as { name: string }[] | null) ?? []).map((city) => city.name));
      }
    }

    loadCities();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="partner-page">
      <section className="container partner-shell" aria-labelledby="partner-title">
        <div className="partner-copy">
          <span>Partner inquiries</span>
          <h1 className="font-display" id="partner-title">
            Partner / Campus / Society Inquiries
          </h1>
          <p>Collaborate with Student Trips SA for recurring campus trips, society specials, and co-branded experiences.</p>

          <div className="partner-support">
            <h2 className="font-display">What we can support</h2>
            <ul>
              {supportItems.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form className="partner-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Inquiry Type
            <select defaultValue="Partner">
              <option>Partner</option>
              <option>Campus</option>
              <option>Society</option>
              <option>Ambassador</option>
            </select>
          </label>

          <div className="partner-form-grid">
            <label>
              Name
              <input autoComplete="name" />
            </label>
            <label>
              Email
              <input autoComplete="email" type="email" />
            </label>
          </div>

          <div className="partner-form-grid">
            <label>
              Phone
              <input autoComplete="tel" type="tel" />
            </label>
            <label>
              Organisation
              <input autoComplete="organization" />
            </label>
          </div>

          <div className="partner-form-grid">
            <label>
              Campus (optional)
              <input />
            </label>
            <label>
              Preferred City
              <select defaultValue="Any city">
                <option>Any city</option>
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Inquiry Details
            <textarea rows={7} />
          </label>

          <button type="submit">Submit Inquiry</button>
        </form>
      </section>
    </main>
  );
}
