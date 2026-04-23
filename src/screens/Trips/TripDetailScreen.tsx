import { CalendarDays, CheckCircle2, MapPin, Ticket, Users } from "lucide-react";
import { useState } from "react";

import { useCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/data";
import type { Trip } from "../../lib/types";
import type { View } from "../../shared/navigation";
import "./TripDetailScreen.css";

const detailTabs = ["Overview", "Full Itinerary", "Tour Details"];

export function TripDetailScreen({ trip, isLoggedIn, setView }: { trip: Trip | null; isLoggedIn: boolean; setView: (view: View) => void }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const { formatTripMoney, priceNotice } = useCurrency();

  if (!trip) {
    return (
      <main className="trip-detail-page">
        <section className="container app-empty-state">
          <h2>No trip selected</h2>
          <p>Choose a trip from the trips page to view its full details.</p>
          <button type="button" onClick={() => setView("trips")}>Browse trips</button>
        </section>
      </main>
    );
  }

  const soldOut = trip.seatsRemaining <= 0 || trip.capacity <= 0 || trip.status === "SOLD_OUT";
  const nearlyFull = trip.status === "NEARLY_FULL";
  const bookingDeadline = formatDate(trip.startDate);
  const pickupPoints = trip.pickupPoints.length > 0 ? trip.pickupPoints : ["Main university pickup"];

  return (
    <main className="trip-detail-page">
      <div className="container trip-detail-layout">
        <section className="trip-detail-main">
          <button className="trip-detail-back" type="button" onClick={() => setView("trips")}>
            Back to trips
          </button>

          <div className="trip-detail-tags">
            <span>{trip.city}</span>
            <span>{trip.category}</span>
            {trip.isSpecial ? <span>Special trip</span> : null}
            <span>{soldOut ? "Sold out" : nearlyFull ? "Nearly full" : "Open"}</span>
          </div>

          <h1 className="font-display">{trip.title}</h1>
          <div className="trip-detail-meta">
            <span><CalendarDays size={14} /> {trip.duration || "Trip duration"}</span>
            <span><MapPin size={14} /> {trip.city}</span>
          </div>
          <p className="trip-detail-summary">{trip.summary}</p>

          <div className="trip-detail-visual">
            {trip.image ? <img src={trip.image} alt={`${trip.title} destination`} /> : null}
            <div className="trip-detail-visual-overlay" />
            <div className="trip-detail-visual-copy">
              <strong>Trip Preview</strong>
              <span>Student Trips SA</span>
            </div>
            <span className="trip-detail-start-pill">Starts in {trip.city}</span>
          </div>

          <nav className="trip-detail-tabs" aria-label="Trip detail sections">
            {detailTabs.map((tab) => (
              <button key={tab} className={tab === activeTab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>

          <section className="card trip-detail-panel">
            {activeTab === "Overview" ? (
              <>
                <h2>Overview</h2>
                <p>{trip.summary} Full inclusions and final meeting details are confirmed before departure.</p>
                <div className="trip-detail-fact-grid">
                  <article>
                    <CalendarDays size={18} />
                    <span>Trip dates</span>
                    <strong>{formatDate(trip.startDate)}</strong>
                  </article>
                  <article>
                    <MapPin size={18} />
                    <span>Pickup points</span>
                    <strong>{pickupPoints.join(", ")}</strong>
                  </article>
                  <article>
                    <Users size={18} />
                    <span>Seats left</span>
                    <strong>{trip.seatsRemaining}</strong>
                  </article>
                  <article>
                    <Ticket size={18} />
                    <span>Booking deadline</span>
                    <strong>{bookingDeadline}</strong>
                  </article>
                </div>
              </>
            ) : null}

            {activeTab === "Full Itinerary" ? (
              <div className="trip-detail-timeline">
                <h2>Full itinerary</h2>
                <article><span>1</span><div><strong>Meet & depart</strong><p>Check in with the group, confirm attendance, and depart from the meeting point.</p></div></article>
                <article><span>2</span><div><strong>Main experience</strong><p>Enjoy the core trip activities with guided timing and group support.</p></div></article>
                <article><span>3</span><div><strong>Return</strong><p>Wrap up, regroup, and return with the Student Trips SA team.</p></div></article>
              </div>
            ) : null}

            {activeTab === "Tour Details" ? (
              <div className="trip-detail-inclusions">
                <h2>Tour details</h2>
                <p>Core details may vary by departure, but this trip is planned around student-friendly timing, support, and clear payment steps.</p>
                <span><CheckCircle2 size={16} /> Group coordination</span>
                <span><CheckCircle2 size={16} /> Secure deposit option</span>
                <span><CheckCircle2 size={16} /> University-ready communication</span>
              </div>
            ) : null}
          </section>
        </section>

        <aside className="trip-detail-sidebar">
          <section className="card trip-booking-card">
            <h2>Book This Trip</h2>
            {trip.originalPrice && trip.originalPrice > trip.price ? (
              <div className="trip-detail-price-block">
                <span>Was {formatTripMoney(trip.originalPrice)}</span>
                <strong>Now {formatTripMoney(trip.price)}</strong>
              </div>
            ) : null}
            <dl>
              <div><dt>From price</dt><dd>{formatTripMoney(trip.price)}</dd></div>
              <div><dt>Deposit option</dt><dd>{formatTripMoney(trip.deposit)}</dd></div>
              <div><dt>Seats remaining</dt><dd>{trip.seatsRemaining}</dd></div>
            </dl>
            <label>
              Choose pickup point
              <select defaultValue={pickupPoints[0]}>
                {pickupPoints.map((point) => (
                  <option key={point} value={point}>{point}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={soldOut} onClick={() => setView(isLoggedIn ? "booking" : "login")}>{soldOut ? "Sold Out" : "Book Now"}</button>
            <p>{priceNotice}</p>
          </section>

          <section className="card trip-help-card">
            <h2>Need help choosing?</h2>
            <p>Compare departures by city and speak to the team for group bookings, deposits, and timing.</p>
            <div>
              <button type="button" onClick={() => setView("trips")}>View city trips</button>
              <button type="button" onClick={() => setView("contact")}>Contact support</button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
