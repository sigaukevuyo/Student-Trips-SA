import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import "./PartnerScreen.css";

const supportItems = [
  "Private departures and society-specific packages",
  "University campaign and ambassador referral setup",
  "City-level operations and manifest coordination",
  "Deposit-first booking models for student affordability",
];

const initialForm = {
  inquiryType: "Partner",
  name: "",
  email: "",
  phone: "",
  organisation: "",
  university: "",
  preferredCity: "Any city",
  details: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

export function PartnerScreen() {
  const [cities, setCities] = useState<string[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      if (!supabase) {
        setCitiesLoading(false);
        return;
      }

      const { data } = await supabase.from("cities").select("name").eq("active", true).order("name");

      if (mounted) {
        setCities(((data as { name: string }[] | null) ?? []).map((city) => city.name));
        setCitiesLoading(false);
      }
    }

    loadCities();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Inquiry submissions are temporarily unavailable. Please try again shortly.");
      return;
    }

    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!form.name.trim() || !email || !form.details.trim()) {
      setMessage("Please complete your name, email, and inquiry details.");
      return;
    }

    if (!emailPattern.test(email)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    if (phone && !phonePattern.test(phone)) {
      setMessage("Please enter a valid phone number, for example +27 79 707 5710.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("partner_inquiries").insert({
      inquiry_type: form.inquiryType,
      name: form.name.trim(),
      email,
      phone: phone || null,
      organisation: form.organisation.trim() || null,
      campus: form.university.trim() || null,
      preferred_city: form.preferredCity === "Any city" ? null : form.preferredCity,
      details: form.details.trim(),
    });
    setSaving(false);

    if (error) {
      setMessage(friendlyError(error, "Could not submit your inquiry. Please try again."));
      return;
    }

    setForm(initialForm);
    setMessage("Inquiry submitted. Our team will get back to you soon.");
  }

  return (
    <main className="partner-page">
      <section className="container partner-shell" aria-labelledby="partner-title">
        <div className="partner-copy">
          <span>Partner inquiries</span>
          <h1 className="font-display" id="partner-title">
            Partner / University / Society Inquiries
          </h1>
          <p>Collaborate with Student Trips SA for recurring university trips, society specials, and co-branded experiences.</p>

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

        <form className="partner-form" onSubmit={handleSubmit}>
          <label>
            Inquiry Type
            <select value={form.inquiryType} onChange={(event) => updateField("inquiryType", event.target.value)}>
              <option value="Partner">Partner</option>
              <option value="Campus">University</option>
              <option value="Society">Society</option>
              <option value="Ambassador">Ambassador</option>
            </select>
          </label>

          <div className="partner-form-grid">
            <label>
              Name
              <input required autoComplete="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
            </label>
            <label>
              Email
              <input required autoComplete="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="name@example.com" />
            </label>
          </div>

          <div className="partner-form-grid">
            <label>
              Phone
              <input autoComplete="tel" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+27 79 707 5710" />
            </label>
            <label>
              Organisation
              <input autoComplete="organization" value={form.organisation} onChange={(event) => updateField("organisation", event.target.value)} />
            </label>
          </div>

          <div className="partner-form-grid">
            <label>
              University (optional)
              <input value={form.university} onChange={(event) => updateField("university", event.target.value)} />
            </label>
            <label>
              Preferred City
              <select value={form.preferredCity} onChange={(event) => updateField("preferredCity", event.target.value)} disabled={citiesLoading || cities.length === 0}>
                <option value="Any city">{citiesLoading ? "Loading cities..." : cities.length === 0 ? "No cities available" : "Choose available city"}</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Inquiry Details
            <textarea required rows={7} value={form.details} onChange={(event) => updateField("details", event.target.value)} />
          </label>

          <button type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Inquiry"}</button>
          {message ? <p className="partner-message">{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
