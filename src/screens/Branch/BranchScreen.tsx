import { MapPin, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { dbTripToTrip, tripSelect, type DbTrip } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import { StatCard } from "../../shared/components/StatCard";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { RoleShell } from "../../shared/layout/RoleShell";
import "./BranchScreen.css";

export function BranchScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadBranch() {
      if (!supabase) {
        setError("Branch data is unavailable until Supabase is configured.");
        setLoading(false);
        return;
      }

      const [tripResult, bookingResult, inquiryResult] = await Promise.all([
        supabase.from("trips").select(tripSelect).eq("published", true).order("start_date").limit(6),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("partner_inquiries").select("id", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      if (tripResult.error || bookingResult.error || inquiryResult.error) {
        setError(tripResult.error?.message ?? bookingResult.error?.message ?? inquiryResult.error?.message ?? "Could not load branch data.");
      }

      setTrips(((tripResult.data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setBookingCount(bookingResult.count ?? 0);
      setInquiryCount(inquiryResult.count ?? 0);
      setLoading(false);
    }

    loadBranch();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <RoleShell title="Branch Dashboard" subtitle="Branch-scoped trips, bookings, and reports" scope="branch">
      {loading ? <section className="card app-empty-state"><ThemeLoader label="Loading branch data" /><p>Loading branch data...</p></section> : null}
      {error && !loading ? <section className="card app-empty-state"><h2>Branch data unavailable</h2><p>{error}</p></section> : null}

      {!loading && !error ? (
        <>
          <div className="ops-stat-grid">
            <StatCard label="Branch bookings" value={String(bookingCount)} detail="Current visible records" />
            <StatCard label="Collected" value="-" detail="Connect payment reporting" />
            <StatCard label="Active trips" value={String(trips.length)} detail={`${trips.filter((trip) => trip.status === "NEARLY_FULL").length} nearly full`} />
            <StatCard label="Inquiries" value={String(inquiryCount)} detail="Partner and campus leads" />
          </div>

          <div className="ops-grid">
            <section className="card">
              <div className="card-head"><h3>Branch departures</h3><MapPin size={20} /></div>
              <div className="stack">
                {trips.length === 0 ? <div className="app-empty-state"><p>No branch departures yet.</p></div> : null}
                {trips.map((trip) => (
                  <article key={trip.id} className="list-item">
                    <div><strong>{trip.title}</strong><span>{trip.city} - {trip.seatsRemaining} seats left</span></div>
                    <StatusBadge status={trip.status} />
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h3>Internal messages</h3><MessageSquare size={20} /></div>
              <div className="stack">
                <div className="app-empty-state"><p>No internal messages yet.</p></div>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </RoleShell>
  );
}
