import { CalendarDays, CheckCircle2, ChevronRight, HelpCircle, LockKeyhole, Mail, MapPin, Settings, ShieldCheck, Star, Ticket, Trash2, UserRound, Wallet, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/data";
import { dbTripToTrip, getTodayIsoDate, tripSelect, type DbTrip } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import { Button } from "../../shared/components/Button";
import { StatCard } from "../../shared/components/StatCard";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { TripCard } from "../../shared/components/TripCard";
import type { View } from "../../shared/navigation";
import "./CustomerScreen.css";

type CustomerProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  campus: string | null;
  date_of_birth: string | null;
  id_passport_number: string | null;
  student_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  dietary_requirements: string | null;
  medical_notes: string | null;
  profile_complete_percent: number | null;
};

type DashboardBooking = {
  id: string;
  ref: string;
  tripTitle: string;
  city: string;
  date: string;
  image: string;
  status: string;
  outstanding: number;
};

type DbBooking = {
  id: string;
  booking_ref: string;
  status: string;
  outstanding_cents: number;
  trips: DbTrip | null;
};

type SavedTripRow = {
  trips: DbTrip | null;
};

type CustomerReview = {
  id: string;
  trip_id: string | null;
  author_name: string;
  rating: number;
  quote: string;
  published: boolean;
  created_at: string;
  trips: { title: string | null } | null;
};

const customerTabs = ["Overview", "Bookings", "Saved Trips", "Payments", "Reviews", "Profile", "Settings"];
const cancellableStatuses = new Set(["Pending Payment", "Awaiting Proof", "Waitlisted", "Confirmed"]);
const payableStatuses = new Set(["Pending Payment", "Awaiting Proof"]);
const activeBookingStatuses = new Set(["Pending Payment", "Awaiting Proof", "Waitlisted", "Confirmed"]);

function daysUntilTrip(date: string) {
  const today = new Date();
  const tripDate = new Date(date);
  today.setHours(0, 0, 0, 0);
  tripDate.setHours(0, 0, 0, 0);
  return Math.ceil((tripDate.getTime() - today.getTime()) / 86_400_000);
}

function getCancellationState(booking: DashboardBooking) {
  if (!cancellableStatuses.has(booking.status)) {
    return { canCancel: false, message: "This booking is already closed." };
  }

  if (booking.status === "Confirmed" && daysUntilTrip(booking.date) < 7) {
    return { canCancel: false, message: "Confirmed bookings can be cancelled until 7 days before departure." };
  }

  if (booking.status === "Confirmed") {
    return { canCancel: true, message: "Cancelling this confirmed booking will send it to refund review." };
  }

  return { canCancel: true, message: "Cancelling this unpaid booking will release the reservation." };
}

export function CustomerScreen({
  onViewCityTrips,
  setSelectedTrip,
  setView,
}: {
  onViewCityTrips: (trip: Trip) => void;
  setSelectedTrip: (trip: Trip) => void;
  setView: (view: View) => void;
}) {
  const { formatTripMoney, priceNotice } = useCurrency();
  const [activeTab, setActiveTab] = useState("Overview");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [recommendedTrips, setRecommendedTrips] = useState<Trip[]>([]);
  const [reviewableTrips, setReviewableTrips] = useState<Trip[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [reviewForm, setReviewForm] = useState({
    trip_id: "",
    rating: "5",
    quote: "",
  });
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsLoading, setSettingsLoading] = useState("");
  const [showMoreSecurityActions, setShowMoreSecurityActions] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<DashboardBooking | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [bookingActionMessage, setBookingActionMessage] = useState("");
  const [bookingActionLoading, setBookingActionLoading] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      if (!supabase) {
        setError("We could not load your dashboard right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (userError || !user) {
        setError("Log in to see your dashboard.");
        setProfile(null);
        setBookings([]);
        setSavedTrips([]);
        setLoading(false);
        return;
      }

      const [profileResult, bookingsResult, savedTripsResult, tripsResult, reviewsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name,email,phone,campus,date_of_birth,id_passport_number,student_number,emergency_contact_name,emergency_contact_phone,dietary_requirements,medical_notes,profile_complete_percent")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select(
            `id,booking_ref,status,outstanding_cents,trips(${tripSelect})`,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_trips")
          .select(
            `trips(${tripSelect})`,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.from("trips").select(tripSelect).eq("published", true).gte("start_date", getTodayIsoDate()).order("start_date").limit(4),
        supabase.from("reviews").select("id,trip_id,author_name,rating,quote,published,created_at,trips(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (!mounted) {
        return;
      }

      if (profileResult.error || bookingsResult.error || savedTripsResult.error || tripsResult.error || reviewsResult.error) {
        setError(friendlyError(profileResult.error ?? bookingsResult.error ?? savedTripsResult.error ?? tripsResult.error ?? reviewsResult.error, "Could not load dashboard."));
      }

      setProfile(
        (profileResult.data as CustomerProfile | null) ?? {
          first_name: null,
          last_name: null,
          email: user.email ?? null,
          phone: null,
          campus: null,
          date_of_birth: null,
          id_passport_number: null,
          student_number: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          dietary_requirements: null,
          medical_notes: null,
          profile_complete_percent: 0,
        },
      );

      const mappedBookings = ((bookingsResult.data as unknown as DbBooking[] | null) ?? [])
        .filter((booking) => booking.trips)
        .map((booking) => ({
          id: booking.id,
          ref: booking.booking_ref,
          tripTitle: booking.trips?.title ?? "Trip",
          city: booking.trips?.cities?.name ?? "South Africa",
          date: booking.trips?.start_date ?? new Date().toISOString(),
          image: booking.trips?.image_url ?? "",
          status: booking.status,
          outstanding: booking.outstanding_cents,
        }));

      setBookings(mappedBookings);
      setReviewableTrips(
        Array.from(
          new Map(
            (((bookingsResult.data as unknown as DbBooking[] | null) ?? [])
              .map((booking) => booking.trips)
              .filter((trip): trip is DbTrip => Boolean(trip))
              .map((trip) => [trip.id, dbTripToTrip(trip)])),
          ).values(),
        ),
      );

      const mappedSavedTrips = ((savedTripsResult.data as unknown as SavedTripRow[] | null) ?? [])
        .map((row) => row.trips)
        .filter((trip): trip is DbTrip => Boolean(trip))
        .map(dbTripToTrip);

      setSavedTrips(mappedSavedTrips);
      setRecommendedTrips(((tripsResult.data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setReviews((reviewsResult.data as CustomerReview[] | null) ?? []);
      setLoading(false);
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [reloadToken]);

  const payableOutstanding = useMemo(() => bookings.reduce((sum, booking) => (payableStatuses.has(booking.status) ? sum + booking.outstanding : sum), 0), [bookings]);
  const needsPaymentCount = useMemo(() => bookings.filter((booking) => booking.outstanding > 0 && payableStatuses.has(booking.status)).length, [bookings]);
  const activeBookings = useMemo(() => bookings.filter((booking) => activeBookingStatuses.has(booking.status)), [bookings]);
  const profilePercent = profile?.profile_complete_percent ?? 0;
  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "traveler";
  const dashboardTrips = recommendedTrips;
  const paymentBookings = bookings.filter((booking) => booking.outstanding > 0 && payableStatuses.has(booking.status));
  const nextBooking = activeBookings[0] ?? null;
  const profileItems = [
    { label: "Identity", complete: Boolean(profile?.date_of_birth && profile.id_passport_number) },
    { label: "Student details", complete: Boolean(profile?.campus && profile.student_number) },
    { label: "Emergency contact", complete: Boolean(profile?.emergency_contact_name && profile.emergency_contact_phone) },
    { label: "Contact details", complete: Boolean(profile?.email && profile.phone) },
  ];
  const profileReviewSections = [
    {
      title: "Traveler identity",
      items: [
        { label: "First name", value: profile?.first_name },
        { label: "Last name", value: profile?.last_name },
        { label: "Date of birth", value: profile?.date_of_birth ? formatDate(profile.date_of_birth) : null },
        { label: "ID / Passport", value: profile?.id_passport_number },
      ],
    },
    {
      title: "Contact & university",
      items: [
        { label: "Email", value: profile?.email },
        { label: "Phone", value: profile?.phone },
        { label: "University", value: profile?.campus },
        { label: "Student number", value: profile?.student_number },
      ],
    },
    {
      title: "Emergency & travel notes",
      items: [
        { label: "Emergency contact", value: profile?.emergency_contact_name },
        { label: "Emergency phone", value: profile?.emergency_contact_phone },
        { label: "Dietary requirements", value: profile?.dietary_requirements },
        { label: "Medical notes", value: profile?.medical_notes },
      ],
    },
  ];

  const handleFavoriteChange = (trip: Trip, saved: boolean) => {
    if (saved) {
      setSavedTrips((current) => (current.some((item) => item.id === trip.id) ? current : [trip, ...current]));
      return;
    }

    setSavedTrips((current) => current.filter((item) => item.id !== trip.id));
  };

  const handleViewTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setView("tripDetail");
  };

  async function submitReview() {
    setReviewMessage("");

    if (!supabase || reviewLoading) return;

    const quote = reviewForm.quote.trim();
    const rating = Number.parseInt(reviewForm.rating, 10);

    if (!quote) {
      setReviewMessage("Please write a short review before submitting.");
      return;
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setReviewMessage("Please choose a rating between 1 and 5.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setReviewMessage("Please log in again before leaving a review.");
      setView("login");
      return;
    }

    setReviewLoading(true);
    const authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.email?.split("@")[0] || "Traveler";
    const { error: insertError } = await supabase.from("reviews").insert({
      user_id: user.id,
      trip_id: reviewForm.trip_id || null,
      author_name: authorName,
      rating,
      quote,
      published: false,
    });
    setReviewLoading(false);

    if (insertError) {
      setReviewMessage(friendlyError(insertError, "Could not submit your review right now. Please try again."));
      return;
    }

    setReviewForm({
      trip_id: "",
      rating: "5",
      quote: "",
    });
    setReviewMessage("Review submitted. It will appear on the site once approved.");
    setReloadToken((current) => current + 1);
  }

  const confirmCancelBooking = async () => {
    if (!supabase || !pendingCancel) return;

    setBookingActionMessage("");
    setBookingActionLoading(pendingCancel.id);

    const { data, error: cancelError } = await supabase.rpc("cancel_booking", { booking_id_param: pendingCancel.id });

    setBookingActionLoading("");

    if (cancelError) {
      setBookingActionMessage(friendlyError(cancelError, "Could not cancel this booking. Please try again."));
      return;
    }

    const nextStatus = typeof data === "string" ? data : pendingCancel.status === "Confirmed" ? "Refund Pending" : "Cancelled";
    setBookings((current) => current.map((booking) => (booking.id === pendingCancel.id ? { ...booking, status: nextStatus } : booking)));
    setPendingCancel(null);
    setBookingActionMessage(nextStatus === "Refund Pending" ? "Cancellation sent for refund review." : "Booking cancelled.");
    setReloadToken((current) => current + 1);
  };

  const sendPasswordReset = async () => {
    setSettingsMessage("");

    if (!supabase || !profile?.email) {
      setSettingsMessage("We could not find an email address for this account.");
      return;
    }

    setSettingsLoading("password");
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo });
    setSettingsLoading("");

    if (resetError) {
      setSettingsMessage(friendlyError(resetError, "Could not send the password reset link. Please try again."));
      return;
    }

    setSettingsMessage("Password reset link sent to your email.");
  };

  const signOutFromSettings = async () => {
    setSettingsLoading("signout");

    if (supabase) {
      await supabase.auth.signOut({ scope: "local" });
    }

    setSettingsLoading("");
    setView("home");
  };

  const signOutFromAllDevices = async () => {
    setSettingsLoading("signout-all");

    if (supabase) {
      await supabase.auth.signOut({ scope: "global" });
    }

    setSettingsLoading("");
    setView("home");
  };

  const deleteAccount = async () => {
    setSettingsMessage("");

    if (!supabase) {
      setSettingsMessage("Account deletion is temporarily unavailable.");
      return;
    }

    setSettingsLoading("delete-account");
    const { error: deleteError } = await supabase.rpc("delete_own_account");
    setSettingsLoading("");

    if (deleteError) {
      setSettingsMessage(friendlyError(deleteError, "Could not delete this account right now. Please try again."));
      return;
    }

    setConfirmDeleteAccount(false);
    await supabase.auth.signOut();
    setView("home");
  };

  return (
    <main className="customer-page">
      <div className="customer-header">
        <div className="container customer-header-inner">
          <div>
            <span className="eyebrow">Customer portal</span>
            <h1 className="font-display">Welcome {displayName}</h1>
            <nav className="customer-tabs" aria-label="Customer dashboard sections">
              {customerTabs.map((tab) => (
                <button key={tab} className={tab === activeTab ? "active" : ""} onClick={() => setActiveTab(tab)} type="button">
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="container customer-content">
        {loading ? (
          <section className="customer-loading card">
            <ThemeLoader label="Loading customer dashboard" />
            <p>Loading customer dashboard...</p>
          </section>
        ) : null}

        {error && !loading ? (
          <section className="customer-empty card">
            <h2 className="font-display">Dashboard unavailable</h2>
            <p>{error}</p>
            <Button onClick={() => setView("login")}>Log in</Button>
          </section>
        ) : null}

        {!loading && !error ? (
          <>
            {activeTab === "Overview" ? (
              <>
                <section className="customer-overview-hero card">
                  <div>
                    <span className="eyebrow">Overview</span>
                    <h2 className="font-display">{nextBooking ? "Your next trip is taking shape" : "Your travel dashboard is ready"}</h2>
                    <p>{nextBooking ? `${nextBooking.tripTitle} starts on ${formatDate(nextBooking.date)}.` : "Explore departures, save favourites, and keep your profile ready before your first booking."}</p>
                  </div>
                  <div className="customer-mini-stats">
                    <StatCard label="Bookings" value={String(activeBookings.length)} detail={nextBooking ? "Upcoming travel" : "None active"} />
                    <StatCard label="Outstanding" value={formatTripMoney(payableOutstanding)} detail={`${needsPaymentCount} payment${needsPaymentCount === 1 ? "" : "s"}`} />
                    <StatCard label="Profile" value={`${profilePercent}%`} detail={profilePercent >= 100 ? "Complete" : "Needs attention"} />
                  </div>
                </section>

                <section className="customer-overview-grid">
                  <article className="card customer-summary-card">
                    <div className="card-head">
                      <h2>Upcoming booking</h2>
                      <CalendarDays size={20} />
                    </div>
                    {nextBooking ? (
                      <div className="customer-feature-item">
                        <strong>{nextBooking.tripTitle}</strong>
                        <span>
                          {nextBooking.city} - {formatDate(nextBooking.date)}
                        </span>
                        <small>{nextBooking.ref}</small>
                        <StatusBadge status={nextBooking.status} />
                      </div>
                    ) : (
                      <div className="customer-empty-inline clean">
                        <strong>No bookings yet</strong>
                        <span>Your first confirmed or pending booking will appear here.</span>
                        <Button onClick={() => setView("trips")}>Explore Trips</Button>
                      </div>
                    )}
                  </article>

                  <article className="card customer-summary-card">
                    <div className="card-head">
                      <h2>Payments</h2>
                      <Wallet size={20} />
                    </div>
                    {paymentBookings.length > 0 ? (
                      <div className="stack">
                        {paymentBookings.slice(0, 2).map((booking) => (
                          <article key={booking.id} className="payment-box">
                            <strong>{booking.tripTitle}</strong>
                            <span>Outstanding {formatTripMoney(booking.outstanding)}</span>
                            <Button>Continue</Button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="customer-empty-inline clean">
                        <strong>No payments due</strong>
                        <span>Balances that need attention will show here.</span>
                      </div>
                    )}
                  </article>

                  <article className="card customer-summary-card">
                    <div className="card-head">
                      <h2>Profile readiness</h2>
                      <span className="customer-percent">{profilePercent}%</span>
                    </div>
                    <div className="customer-checklist">
                      {profileItems.map((item) => (
                        <span key={item.label} className={item.complete ? "complete" : ""}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                    {profilePercent < 100 ? <Button onClick={() => setView("onboarding")}>Complete Profile</Button> : null}
                  </article>
                </section>

                <section>
                  <div className="section-head">
                    <div>
                      <span className="section-kicker">Suggested trips</span>
                      <h2>Trips to start with</h2>
                    </div>
                  </div>
                  {dashboardTrips.length > 0 ? (
                    <div className="trip-grid">
                      {dashboardTrips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} initialSaved={savedTrips.some((item) => item.id === trip.id)} onFavoriteChange={handleFavoriteChange} onViewCityTrips={onViewCityTrips} onViewTrip={handleViewTrip} />
                      ))}
                    </div>
                  ) : (
                    <div className="customer-empty-panel">
                      <strong>No trips available yet</strong>
                      <span>New departures and saved favourites will show here when available.</span>
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {activeTab === "Bookings" ? (
              <section className="card customer-bookings-panel">
                <div className="customer-bookings-head">
                  <div>
                    <h2 className="font-display">Bookings</h2>
                    <p>Manage your upcoming and past bookings.</p>
                  </div>
                  <span>
                    <CalendarDays size={20} />
                  </span>
                </div>
                {bookingActionMessage ? <p className="auth-message">{bookingActionMessage}</p> : null}
                <div className="customer-bookings-list">
                  {bookings.length > 0 ? (
                    bookings.map((booking) => {
                      const cancellation = getCancellationState(booking);
                      const isClosed = !cancellation.canCancel;
                      const isConfirmed = booking.status === "Confirmed";

                      return (
                        <article key={booking.id} className="customer-booking-row">
                          <div className="customer-booking-media">
                            {booking.image ? <img src={booking.image} alt={`${booking.tripTitle} preview`} /> : <span />}
                          </div>
                          <div className="customer-booking-main">
                            <strong>{booking.tripTitle}</strong>
                            <div className="customer-booking-meta">
                              <span><CalendarDays size={15} /> {formatDate(booking.date)}</span>
                              <i />
                              <span><MapPin size={15} /> {booking.city}</span>
                            </div>
                            <span className="customer-booking-ref"><Ticket size={16} /> {booking.ref}</span>
                          </div>
                          <div className="customer-booking-status">
                            <span className={`customer-booking-status-pill ${isClosed ? "closed" : isConfirmed ? "confirmed" : ""}`}>
                              {isClosed ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                              {booking.status}
                            </span>
                            <p>{cancellation.message}</p>
                          </div>
                          <div className="customer-booking-actions">
                            {cancellation.canCancel ? (
                              <button type="button" onClick={() => setPendingCancel(booking)} disabled={bookingActionLoading === booking.id}>
                                <span>{bookingActionLoading === booking.id ? "Cancelling..." : "Cancel booking"}</span>
                                <Trash2 size={18} />
                              </button>
                            ) : (
                              <span className="customer-booking-closed">Closed</span>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="customer-empty-inline clean">
                      <strong>No bookings yet</strong>
                      <span>When you reserve a trip, every booking detail will live here.</span>
                    </div>
                  )}
                </div>
                <div className="customer-bookings-help">
                  <HelpCircle size={18} />
                  <strong>Need help?</strong>
                  <button type="button" onClick={() => setView("contact")}>
                    Visit our Help Centre <ChevronRight size={16} />
                  </button>
                </div>
              </section>
            ) : null}

            {pendingCancel ? (
              <div className="customer-feedback-popover" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
                <section>
                  <strong id="cancel-booking-title">Cancel booking?</strong>
                  <p>{getCancellationState(pendingCancel).message}</p>
                  <div className="customer-feedback-actions">
                    <Button variant="secondary" onClick={() => setPendingCancel(null)} disabled={Boolean(bookingActionLoading)}>Keep booking</Button>
                    <Button variant="ghost" onClick={confirmCancelBooking} disabled={Boolean(bookingActionLoading)}>
                      {bookingActionLoading ? "Cancelling..." : "Cancel booking"}
                    </Button>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === "Saved Trips" ? (
              <section>
                {savedTrips.length > 0 ? (
                  <div className="trip-grid">
                    {savedTrips.map((trip) => (
                      <TripCard key={trip.id} trip={trip} initialSaved onFavoriteChange={handleFavoriteChange} onViewCityTrips={onViewCityTrips} onViewTrip={handleViewTrip} />
                    ))}
                  </div>
                ) : (
                  <div className="customer-empty-panel">
                    <strong>No saved trips yet</strong>
                    <span>Tap the heart on any trip to build a shortlist.</span>
                    <Button onClick={() => setView("trips")}>Find Trips</Button>
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === "Payments" ? (
              <section className="card">
                <div className="card-head">
                  <h2>Payments</h2>
                  <Wallet size={20} />
                </div>
                <div className="stack">
                  {paymentBookings.length > 0 ? (
                    paymentBookings.map((booking) => (
                      <article key={booking.id} className="payment-box">
                        <strong>{booking.tripTitle}</strong>
                        <span>Outstanding {formatTripMoney(booking.outstanding)}</span>
                        <Button>Continue</Button>
                      </article>
                    ))
                  ) : (
                    <div className="customer-empty-inline clean">
                      <strong>No payments due</strong>
                      <span>{priceNotice}</span>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "Reviews" ? (
              <section className="customer-reviews-layout">
                <article className="card customer-review-form-card">
                  <div className="card-head">
                    <div>
                      <h2>Leave a review</h2>
                      <p>Share your trip experience. Reviews are approved before they appear on the site.</p>
                    </div>
                    <Star size={20} />
                  </div>
                  {reviewableTrips.length === 0 ? (
                    <div className="customer-empty-inline clean">
                      <strong>No trips to review yet</strong>
                      <span>Your booked trips will show here once you have travel history in your account.</span>
                    </div>
                  ) : (
                    <div className="customer-review-form">
                      <label>
                        Trip
                        <select value={reviewForm.trip_id} onChange={(event) => setReviewForm((current) => ({ ...current, trip_id: event.target.value }))}>
                          <option value="">General review</option>
                          {reviewableTrips.map((trip) => (
                            <option key={trip.id} value={trip.id}>{trip.title}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Rating
                        <select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))}>
                          <option value="5">5 stars</option>
                          <option value="4">4 stars</option>
                          <option value="3">3 stars</option>
                          <option value="2">2 stars</option>
                          <option value="1">1 star</option>
                        </select>
                      </label>
                      <label className="customer-review-form-full">
                        Your review
                        <textarea
                          value={reviewForm.quote}
                          onChange={(event) => setReviewForm((current) => ({ ...current, quote: event.target.value }))}
                          rows={5}
                          placeholder="Tell other travelers what stood out about your trip."
                        />
                      </label>
                      <div className="customer-review-form-actions">
                        <Button onClick={submitReview} disabled={reviewLoading}>{reviewLoading ? "Submitting..." : "Submit Review"}</Button>
                      </div>
                    </div>
                  )}
                  {reviewMessage ? <p className="auth-message">{reviewMessage}</p> : null}
                </article>

                <article className="card customer-review-history-card">
                  <div className="card-head">
                    <div>
                      <h2>Your reviews</h2>
                      <p>Track submitted reviews and whether they are live on the site yet.</p>
                    </div>
                    <Star size={20} />
                  </div>
                  <div className="customer-review-history">
                    {reviews.length === 0 ? (
                      <div className="customer-empty-inline clean">
                        <strong>No reviews yet</strong>
                        <span>Once you submit a review, it will appear here with its approval status.</span>
                      </div>
                    ) : (
                      reviews.map((review) => (
                        <article key={review.id} className="customer-review-row">
                          <div>
                            <strong>{review.trips?.title ?? "General review"}</strong>
                            <span>{review.rating}/5 stars - {formatDate(review.created_at)}</span>
                          </div>
                          <p>{review.quote}</p>
                          <StatusBadge status={review.published ? "Published" : "Pending"} />
                        </article>
                      ))
                    )}
                  </div>
                </article>
              </section>
            ) : null}

            {activeTab === "Profile" ? (
              <section className="card customer-profile-review">
                <div className="customer-profile-review-head">
                  <div>
                    <span className="section-kicker">Profile review</span>
                    <h2 className="font-display">Traveler profile</h2>
                    <p>Review the details used for trip check-in, university lists, and emergency support.</p>
                  </div>
                  <span className="customer-percent">{profilePercent}%</span>
                </div>

                <div className="customer-profile-review-grid">
                  {profileReviewSections.map((section) => (
                    <article key={section.title} className="customer-profile-section">
                      <h3>{section.title}</h3>
                      <dl>
                        {section.items.map((item) => (
                          <div key={item.label}>
                            <dt>{item.label}</dt>
                            <dd className={item.value ? "" : "missing"}>{item.value || "Not provided"}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="customer-profile-review-actions">
                  <Button onClick={() => setView("onboarding")}>Edit Profile</Button>
                </div>
              </section>
            ) : null}

            {activeTab === "Settings" ? (
              <section className="customer-settings">
                <div className="customer-settings-head card">
                  <div>
                    <span className="section-kicker">Settings</span>
                    <h2 className="font-display">Account settings</h2>
                    <p>Manage account access, profile readiness, and common account actions.</p>
                  </div>
                  <span className={profilePercent >= 100 ? "config-pill ready" : "config-pill"}>{profilePercent >= 100 ? "Ready to travel" : "Profile needs review"}</span>
                </div>

                <div className="customer-settings-grid">
                  <article className="card customer-settings-card">
                    <div className="card-head">
                      <h2>Account</h2>
                      <UserRound size={20} />
                    </div>
                    <dl className="customer-settings-list">
                      <div>
                        <dt>Name</dt>
                        <dd>{`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{profile?.email ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>{profile?.phone ?? "Not provided"}</dd>
                      </div>
                    </dl>
                    <Button onClick={() => setActiveTab("Profile")}>Review Profile</Button>
                  </article>

                  <article className="card customer-settings-card">
                    <div className="card-head">
                      <h2>Security</h2>
                      <ShieldCheck size={20} />
                    </div>
                    <div className="customer-settings-actions">
                      <button type="button" onClick={sendPasswordReset} disabled={settingsLoading === "password"}>
                        <LockKeyhole size={18} />
                        <span>{settingsLoading === "password" ? "Sending reset link" : "Send password reset link"}</span>
                      </button>
                      <button type="button" onClick={signOutFromSettings} disabled={settingsLoading === "signout"}>
                        <Settings size={18} />
                        <span>{settingsLoading === "signout" ? "Signing out" : "Sign out of this device"}</span>
                      </button>
                      <button type="button" onClick={signOutFromAllDevices} disabled={settingsLoading === "signout-all"}>
                        <ShieldCheck size={18} />
                        <span>{settingsLoading === "signout-all" ? "Signing out everywhere" : "Sign out of all devices"}</span>
                      </button>
                      <button type="button" onClick={() => setShowMoreSecurityActions((current) => !current)}>
                        <Settings size={18} />
                        <span>{showMoreSecurityActions ? "Hide more actions" : "More"}</span>
                      </button>
                      {showMoreSecurityActions ? (
                        <button className="danger" type="button" onClick={() => setConfirmDeleteAccount(true)} disabled={settingsLoading === "delete-account"}>
                          <Trash2 size={18} />
                          <span>Delete account</span>
                        </button>
                      ) : null}
                    </div>
                  </article>

                  <article className="card customer-settings-card">
                    <div className="card-head">
                      <h2>Trip preferences</h2>
                      <Mail size={20} />
                    </div>
                    <dl className="customer-settings-list">
                      <div>
                        <dt>Dietary requirements</dt>
                        <dd>{profile?.dietary_requirements || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Medical notes</dt>
                        <dd>{profile?.medical_notes || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Saved trips</dt>
                        <dd>{savedTrips.length}</dd>
                      </div>
                    </dl>
                    <Button onClick={() => setView("onboarding")}>Update Preferences</Button>
                  </article>
                </div>

                <div className="customer-settings-shortcuts">
                  <button type="button" onClick={() => setView("trips")}>Browse trips</button>
                  <button type="button" onClick={() => setActiveTab("Saved Trips")}>Saved trips</button>
                  <button type="button" onClick={() => setActiveTab("Payments")}>Payments</button>
                  <button type="button" onClick={() => setView("contact")}>Contact support</button>
                </div>

                {settingsMessage ? <p className="auth-message">{settingsMessage}</p> : null}
              </section>
            ) : null}

            {confirmDeleteAccount ? (
              <div className="customer-feedback-popover" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                <section>
                  <strong id="delete-account-title">Delete account?</strong>
                  <p>This permanently removes your login and account records. This action cannot be undone.</p>
                  <div className="customer-feedback-actions">
                    <Button variant="secondary" onClick={() => setConfirmDeleteAccount(false)} disabled={Boolean(settingsLoading)}>Cancel</Button>
                    <Button variant="ghost" onClick={deleteAccount} disabled={settingsLoading === "delete-account"}>
                      {settingsLoading === "delete-account" ? "Deleting..." : "Delete account"}
                    </Button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
