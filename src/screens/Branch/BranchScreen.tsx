import { CreditCard, FileCheck2, MapPin, MessageSquare, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDate, formatMoney } from "../../lib/data";
import { dbTripToTrip, tripSelect, type DbTrip } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import { Button } from "../../shared/components/Button";
import { StatCard } from "../../shared/components/StatCard";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { RoleShell } from "../../shared/layout/RoleShell";
import "./BranchScreen.css";

type BranchProfile = {
  id: string;
  role: "customer" | "branch" | "admin";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  branch_city_id: string | null;
  cities: { name: string | null } | null;
};

type BranchBooking = {
  id: string;
  user_id: string;
  booking_ref: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  outstanding_cents: number;
  created_at: string;
  trips: { title: string | null; start_date: string | null } | null;
};

type BranchPayment = {
  id: string;
  amount_cents: number;
  status: string;
  method: string;
  created_at: string;
  bookings: { booking_ref: string | null; trips?: { title: string | null } | null } | null;
};

type BranchProof = {
  id: string;
  booking_id: string;
  file_path: string;
  file_name: string | null;
  amount_cents: number | null;
  approved: boolean | null;
  created_at: string;
  bookings: { booking_ref: string | null; trips?: { title: string | null } | null } | null;
};

type BranchInquiry = {
  id: string;
  inquiry_type: string;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  campus: string | null;
  details: string | null;
  created_at: string;
};

type BranchCustomer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type BranchReview = {
  id: string;
  author_name: string;
  rating: number;
  quote: string;
  published: boolean;
  created_at: string;
  trips: { title: string | null } | null;
};

const branchTabs = ["Overview", "Trips", "Bookings", "Customers", "Payments", "Reviews", "Reports"];

function personName(profile: Pick<BranchProfile, "first_name" | "last_name" | "email"> | null) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return name || profile?.email || "Branch manager";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BranchScreen() {
  const [profile, setProfile] = useState<BranchProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<BranchBooking[]>([]);
  const [payments, setPayments] = useState<BranchPayment[]>([]);
  const [proofs, setProofs] = useState<BranchProof[]>([]);
  const [inquiries, setInquiries] = useState<BranchInquiry[]>([]);
  const [customers, setCustomers] = useState<BranchCustomer[]>([]);
  const [reviews, setReviews] = useState<BranchReview[]>([]);
  const [activeTab, setActiveTab] = useState(branchTabs[0]);
  const [showTripModal, setShowTripModal] = useState(false);
  const [saving, setSaving] = useState("");
  const [tripForm, setTripForm] = useState({
    title: "",
    slug: "",
    category: "",
    summary: "",
    meeting_point: "",
    start_date: "",
    duration: "",
    price: "",
    original_price: "",
    deposit: "",
    capacity: "",
    seats_remaining: "",
    is_special: false,
    special_collection_slug: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBranch = useCallback(async (mounted = true) => {
      setLoading(true);
      setError("");

      if (!supabase) {
        setError("Branch data is unavailable until Supabase is configured.");
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (userError || !userId) {
        setError(friendlyError(userError, "Please sign in as a branch manager."));
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,role,first_name,last_name,email,branch_city_id,cities(name)")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (profileError || !profileData) {
        setError(friendlyError(profileError, "Branch profile was not found."));
        setLoading(false);
        return;
      }

      const branchProfile = profileData as BranchProfile;
      setProfile(branchProfile);

      if (branchProfile.role !== "branch" && branchProfile.role !== "admin") {
        setError("This dashboard is only available to branch managers.");
        setLoading(false);
        return;
      }

      if (!branchProfile.branch_city_id) {
        setError("This branch manager is not assigned to a city yet.");
        setLoading(false);
        return;
      }

      const cityId = branchProfile.branch_city_id;
      const cityName = branchProfile.cities?.name ?? "";

      const [tripResult, bookingResult, paymentResult, proofResult, inquiryResult, reviewResult] = await Promise.all([
        supabase.from("trips").select(tripSelect).eq("city_id", cityId).order("start_date").limit(50),
        supabase
          .from("bookings")
          .select("id,user_id,booking_ref,status,total_cents,paid_cents,outstanding_cents,created_at,trips!inner(title,start_date,city_id)")
          .eq("trips.city_id", cityId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("payments")
          .select("id,amount_cents,status,method,created_at,bookings!inner(booking_ref,trips!inner(title,city_id))")
          .eq("bookings.trips.city_id", cityId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("payment_proofs")
          .select("id,booking_id,file_path,file_name,amount_cents,approved,created_at,bookings!inner(booking_ref,trips!inner(title,city_id))")
          .eq("bookings.trips.city_id", cityId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("partner_inquiries")
          .select("id,inquiry_type,name,email,phone,organisation,campus,details,created_at")
          .ilike("preferred_city", cityName)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("reviews")
          .select("id,author_name,rating,quote,published,created_at,trips!inner(title,city_id)")
          .eq("trips.city_id", cityId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (!mounted) return;

      const firstError = tripResult.error ?? bookingResult.error ?? paymentResult.error ?? proofResult.error ?? inquiryResult.error ?? reviewResult.error;
      if (firstError) {
        setError(friendlyError(firstError, "We could not load branch data right now. Please try again."));
      }

      setTrips(((tripResult.data as unknown as DbTrip[] | null) ?? []).map(dbTripToTrip));
      setBookings((bookingResult.data as unknown as BranchBooking[] | null) ?? []);
      setPayments((paymentResult.data as unknown as BranchPayment[] | null) ?? []);
      setProofs((proofResult.data as unknown as BranchProof[] | null) ?? []);
      setInquiries((inquiryResult.data as BranchInquiry[] | null) ?? []);
      setReviews((reviewResult.data as unknown as BranchReview[] | null) ?? []);

      const userIds = Array.from(new Set(((bookingResult.data as unknown as BranchBooking[] | null) ?? []).map((booking) => booking.user_id)));
      if (userIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,email,phone")
          .in("id", userIds);

        if (!mounted) return;

        if (customerError) {
          setError(friendlyError(customerError, "We could not load branch customers right now."));
        }

        setCustomers((customerData as BranchCustomer[] | null) ?? []);
      } else {
        setCustomers([]);
      }
      setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadBranch();

    return () => {
      mounted = false;
    };
  }, [loadBranch]);

  function setTripFormValue(field: keyof typeof tripForm, value: string) {
    setTripForm((current) => {
      if (field === "title" && (!current.slug || current.slug === slugify(current.title))) {
        return { ...current, title: value, slug: slugify(value) };
      }

      return { ...current, [field]: value };
    });
  }

  function resetTripForm() {
    setTripForm({
      title: "",
      slug: "",
      category: "",
      summary: "",
      meeting_point: "",
      start_date: "",
      duration: "",
      price: "",
      original_price: "",
      deposit: "",
      capacity: "",
      seats_remaining: "",
      is_special: false,
      special_collection_slug: "",
    });
  }

  async function createTrip() {
    if (!supabase) return;

    if (!profile?.branch_city_id) {
      setError("Your branch profile is not assigned to a city yet.");
      return;
    }

    const title = tripForm.title.trim();
    const slug = (tripForm.slug.trim() || slugify(title)).trim();
    const priceCents = Math.round(Number(tripForm.price) * 100);
    const originalPriceCents = tripForm.original_price ? Math.round(Number(tripForm.original_price) * 100) : null;
    const depositCents = Math.round(Number(tripForm.deposit || "0") * 100);
    const capacity = Number.parseInt(tripForm.capacity, 10);
    const seatsRemaining = Number.parseInt(tripForm.seats_remaining || tripForm.capacity, 10);
    const specialCollectionSlug = tripForm.is_special ? (tripForm.special_collection_slug.trim() || slugify(title)) : null;

    if (!title || !slug || !tripForm.category.trim() || !tripForm.start_date) {
      setError("Trip title, slug, category, and start date are required.");
      return;
    }

    if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(seatsRemaining) || seatsRemaining < 0) {
      setError("Trip price, capacity, and seats must be valid numbers.");
      return;
    }

    if (originalPriceCents !== null && (!Number.isFinite(originalPriceCents) || originalPriceCents < priceCents)) {
      setError("Original price must be greater than or equal to the current price.");
      return;
    }

    setSaving("trips-create");
    const { error: insertError } = await supabase.from("trips").insert({
      city_id: profile.branch_city_id,
      title,
      slug,
      category: tripForm.category.trim(),
      summary: tripForm.summary.trim() || null,
      meeting_point: tripForm.meeting_point.trim() || null,
      pickup_points: tripForm.meeting_point.trim() ? [tripForm.meeting_point.trim()] : [],
      start_date: tripForm.start_date,
      duration: tripForm.duration.trim() || null,
      price_cents: priceCents,
      original_price_cents: originalPriceCents,
      deposit_cents: depositCents,
      capacity,
      seats_remaining: Math.min(seatsRemaining, capacity),
      is_special: tripForm.is_special,
      special_collection_slug: specialCollectionSlug,
      status: "OPEN",
      featured: false,
      published: true,
      tags: [],
    });

    if (insertError) {
      setError(friendlyError(insertError, "Could not add this trip. Please check the details and try again."));
    } else {
      setShowTripModal(false);
      resetTripForm();
      await loadBranch();
      setActiveTab("Trips");
    }
    setSaving("");
  }

  async function reviewPaymentProof(proof: BranchProof, approved: boolean) {
    if (!supabase || proof.approved !== null) return;

    setSaving(`payment-proof-${proof.id}`);
    setError("");

    const reviewedAt = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error: proofError } = await supabase
      .from("payment_proofs")
      .update({
        approved,
        reviewed_at: reviewedAt,
        reviewed_by: userData.user?.id ?? null,
      })
      .eq("id", proof.id);

    if (proofError) {
      setSaving("");
      setError(friendlyError(proofError, "Could not update this payment proof. Please try again."));
      return;
    }

    if (!approved) {
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ status: "Pending Payment" })
        .eq("id", proof.booking_id);

      if (bookingError) {
        setError(friendlyError(bookingError, "Could not update this booking. Please try again."));
      } else {
        await loadBranch();
      }
      setSaving("");
      return;
    }

    const amountPaid = proof.amount_cents ?? 0;
    const { data: booking, error: bookingLoadError } = await supabase
      .from("bookings")
      .select("total_cents,deposit_cents,paid_cents")
      .eq("id", proof.booking_id)
      .maybeSingle();

    if (bookingLoadError || !booking) {
      setSaving("");
      setError(friendlyError(bookingLoadError, "Could not load booking for this proof."));
      return;
    }

    const nextPaid = Math.min((booking.paid_cents ?? 0) + amountPaid, booking.total_cents ?? amountPaid);
    const fullyPaid = nextPaid >= (booking.total_cents ?? nextPaid);
    const depositCovered = nextPaid >= (booking.deposit_cents ?? 0);
    const nextStatus = fullyPaid || depositCovered ? "Confirmed" : "Pending Payment";

    const { error: paymentError } = await supabase
      .from("payments")
      .update({ status: "Paid", paid_at: reviewedAt })
      .eq("booking_id", proof.booking_id)
      .eq("status", "Pending");

    if (paymentError) {
      setSaving("");
      setError(friendlyError(paymentError, "Could not record this payment. Please try again."));
      return;
    }

    const { error: bookingError } = await supabase
      .from("bookings")
      .update({ paid_cents: nextPaid, status: nextStatus })
      .eq("id", proof.booking_id);

    if (bookingError) {
      setError(friendlyError(bookingError, "Could not update this booking. Please try again."));
    } else {
      await loadBranch();
    }
    setSaving("");
  }

  async function openPaymentProof(proof: BranchProof) {
    if (!supabase) return;

    setSaving(`payment-proof-view-${proof.id}`);
    setError("");

    const { data, error: signedUrlError } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof.file_path, 60 * 5);

    if (signedUrlError || !data?.signedUrl) {
      setError(friendlyError(signedUrlError, "Could not open payment proof."));
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    setSaving("");
  }

  async function setReviewPublished(review: BranchReview, published: boolean) {
    if (!supabase) return;

    setSaving(`review-${review.id}`);
    setError("");
    const { error: reviewError } = await supabase.from("reviews").update({ published }).eq("id", review.id);

    if (reviewError) {
      setError(friendlyError(reviewError, "Could not update this review right now. Please try again."));
    } else {
      await loadBranch();
    }
    setSaving("");
  }

  const paid = useMemo(() => payments.filter((payment) => payment.status === "Paid").reduce((sum, payment) => sum + payment.amount_cents, 0), [payments]);
  const outstanding = useMemo(() => bookings.reduce((sum, booking) => sum + booking.outstanding_cents, 0), [bookings]);
  const pendingProofs = useMemo(() => proofs.filter((proof) => proof.approved === null).length, [proofs]);
  const activeTrips = useMemo(() => trips.filter((trip) => trip.status !== "SOLD_OUT"), [trips]);
  const customerById = useMemo(() => Object.fromEntries(customers.map((customer) => [customer.id, customer])), [customers]);

  return (
    <RoleShell
      scope="branch"
      tabs={branchTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userName={personName(profile)}
      userRole="Branch Manager"
    >
      {loading ? <section className="card app-empty-state"><ThemeLoader label="Loading branch dashboard" /><p>Loading branch dashboard...</p></section> : null}
      {error && !loading ? <section className="card app-empty-state"><h2>Branch data unavailable</h2><p>{error}</p></section> : null}

      {!loading && !error && activeTab === "Overview" ? (
        <>
          <div className="ops-stat-grid">
            <StatCard label="Bookings" value={String(bookings.length)} detail={`${formatMoney(outstanding)} outstanding`} />
            <StatCard label="Collected" value={formatMoney(paid)} detail="Paid branch payments" />
            <StatCard label="Active trips" value={String(activeTrips.length)} detail={`${trips.filter((trip) => trip.status === "NEARLY_FULL").length} nearly full`} />
            <StatCard label="Proof queue" value={String(pendingProofs)} detail={`${inquiries.length} city leads`} />
          </div>

          <div className="branch-dashboard-grid">
            <section className="card">
              <div className="card-head"><h3>Branch departures</h3><MapPin size={20} /></div>
              <div className="stack">
                {trips.length === 0 ? <div className="app-empty-state"><p>No departures for this branch yet.</p></div> : null}
                {trips.slice(0, 8).map((trip) => (
                  <article key={trip.id} className="list-item">
                    <div><strong>{trip.title}</strong><span>{formatDate(trip.startDate)} - {trip.seatsRemaining} seats left</span></div>
                    <StatusBadge status={trip.status} />
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h3>Recent bookings</h3><CreditCard size={20} /></div>
              <div className="branch-table">
                {bookings.length === 0 ? <div className="app-empty-state"><p>No bookings for this branch yet.</p></div> : null}
                {bookings.slice(0, 8).map((booking) => (
                  <article key={booking.id} className="branch-table-row">
                    <div><strong>{booking.booking_ref}</strong><span>{booking.trips?.title ?? "Trip"}</span></div>
                    <div><strong>{formatMoney(booking.total_cents)}</strong><span>{formatMoney(booking.outstanding_cents)} outstanding</span></div>
                    <StatusBadge status={booking.status} />
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h3>Payment proofs</h3><FileCheck2 size={20} /></div>
              <div className="branch-table">
                {proofs.length === 0 ? <div className="app-empty-state"><p>No payment proofs for this branch yet.</p></div> : null}
                {proofs.slice(0, 8).map((proof) => (
                  <article key={proof.id} className="branch-table-row">
                    <div><strong>{proof.bookings?.booking_ref ?? "Proof"}</strong><span>{proof.file_name ?? proof.bookings?.trips?.title ?? "Uploaded file"}</span></div>
                    <div><strong>{proof.amount_cents ? formatMoney(proof.amount_cents) : "Not captured"}</strong><span>{formatDate(proof.created_at)}</span></div>
                    <div>
                      <StatusBadge status={proof.approved === null ? "Pending" : proof.approved ? "Approved" : "Rejected"} />
                      {proof.approved === null ? (
                        <div className="branch-proof-actions">
                          <Button variant="ghost" onClick={() => openPaymentProof(proof)} disabled={saving === `payment-proof-view-${proof.id}`}>View</Button>
                          <Button variant="secondary" onClick={() => reviewPaymentProof(proof, true)} disabled={saving === `payment-proof-${proof.id}`}>Confirm</Button>
                          <Button variant="ghost" onClick={() => reviewPaymentProof(proof, false)} disabled={saving === `payment-proof-${proof.id}`}>Reject</Button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h3>City inquiries</h3><MessageSquare size={20} /></div>
              <div className="branch-table">
                {inquiries.length === 0 ? <div className="app-empty-state"><p>No inquiries for this branch yet.</p></div> : null}
                {inquiries.slice(0, 8).map((inquiry) => (
                  <article key={inquiry.id} className="branch-table-row">
                    <div><strong>{inquiry.name}</strong><span>{inquiry.organisation ?? inquiry.campus ?? inquiry.inquiry_type}</span></div>
                    <div><strong>{inquiry.email}</strong><span>{inquiry.phone ?? formatDate(inquiry.created_at)}</span></div>
                    <a href={`mailto:${inquiry.email}`}>Email</a>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {!loading && !error && activeTab === "Trips" ? (
        <section className="card">
          <div className="card-head">
            <h3>Trips</h3>
            <button className="branch-add-button" type="button" onClick={() => setShowTripModal(true)}>Add Trip</button>
          </div>
          <div className="branch-table">
            {trips.length === 0 ? <div className="app-empty-state"><p>No trips for this branch yet.</p></div> : null}
            {trips.map((trip) => (
              <article key={trip.id} className="branch-table-row">
                <div><strong>{trip.title}</strong><span>{trip.category}</span></div>
                <div><strong>{formatDate(trip.startDate)}</strong><span>{trip.seatsRemaining} seats left</span></div>
                <StatusBadge status={trip.status} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Bookings" ? (
        <section className="card">
          <div className="card-head"><h3>Bookings</h3><CreditCard size={20} /></div>
          <div className="branch-table">
            {bookings.length === 0 ? <div className="app-empty-state"><p>No bookings for this branch yet.</p></div> : null}
            {bookings.map((booking) => {
              const customer = customerById[booking.user_id];
              return (
                <article key={booking.id} className="branch-table-row">
                  <div><strong>{booking.booking_ref}</strong><span>{booking.trips?.title ?? "Trip"}</span></div>
                  <div><strong>{personName(customer ?? null)}</strong><span>{customer?.email ?? "No email"}</span></div>
                  <StatusBadge status={booking.status} />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Customers" ? (
        <section className="card">
          <div className="card-head"><h3>Customers</h3><Users size={20} /></div>
          <div className="branch-table">
            {customers.length === 0 ? <div className="app-empty-state"><p>No customers for this branch yet.</p></div> : null}
            {customers.map((customer) => (
              <article key={customer.id} className="branch-table-row">
                <div><strong>{personName(customer)}</strong><span>{customer.email ?? "No email"}</span></div>
                <div><strong>{customer.phone ?? "No phone"}</strong><span>{bookings.filter((booking) => booking.user_id === customer.id).length} bookings</span></div>
                <a href={customer.email ? `mailto:${customer.email}` : undefined}>Email</a>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Payments" ? (
        <section className="card">
          <div className="card-head"><h3>Payments</h3><CreditCard size={20} /></div>
          <div className="branch-proof-list">
            {proofs.length === 0 ? <div className="app-empty-state"><p>No payment proofs for this branch yet.</p></div> : null}
            {proofs.map((proof) => (
              <article key={proof.id} className="branch-proof-row">
                <div className="branch-proof-head">
                  <div>
                    <strong>{proof.bookings?.booking_ref ?? "Proof"}</strong>
                    <span>{proof.file_name ?? proof.bookings?.trips?.title ?? "Uploaded file"}</span>
                  </div>
                  <StatusBadge status={proof.approved === null ? "Pending" : proof.approved ? "Approved" : "Rejected"} />
                </div>
                <div className="branch-proof-meta">
                  <span>{proof.amount_cents ? formatMoney(proof.amount_cents) : "Not captured"}</span>
                  <span>{formatDate(proof.created_at)}</span>
                  <span>{proof.approved === null ? "Waiting for branch review" : proof.approved ? "Confirmed" : "Rejected"}</span>
                </div>
                <div className="branch-proof-actions">
                  <Button variant="ghost" onClick={() => openPaymentProof(proof)} disabled={saving === `payment-proof-view-${proof.id}`}>View</Button>
                  <Button variant="secondary" onClick={() => reviewPaymentProof(proof, true)} disabled={proof.approved !== null || saving === `payment-proof-${proof.id}`}>Confirm</Button>
                  <Button variant="ghost" onClick={() => reviewPaymentProof(proof, false)} disabled={proof.approved !== null || saving === `payment-proof-${proof.id}`}>Reject</Button>
                </div>
              </article>
            ))}
          </div>
          <div className="branch-table">
            {payments.length === 0 ? <div className="app-empty-state"><p>No payments for this branch yet.</p></div> : null}
            {payments.map((payment) => (
              <article key={payment.id} className="branch-table-row">
                <div><strong>{payment.bookings?.booking_ref ?? "Payment"}</strong><span>{payment.bookings?.trips?.title ?? payment.method}</span></div>
                <div><strong>{formatMoney(payment.amount_cents)}</strong><span>{formatDate(payment.created_at)}</span></div>
                <StatusBadge status={payment.status} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Reviews" ? (
        <section className="card">
          <div className="card-head"><h3>Reviews</h3><MessageSquare size={20} /></div>
          <div className="branch-review-list">
            {reviews.length === 0 ? <div className="app-empty-state"><p>No customer reviews for this branch yet.</p></div> : null}
            {reviews.map((review) => (
              <article key={review.id} className="branch-review-row">
                <div className="branch-review-head">
                  <div>
                    <strong>{review.author_name}</strong>
                    <span>{review.trips?.title ?? "General review"} - {review.rating}/5 stars</span>
                  </div>
                  <StatusBadge status={review.published ? "Published" : "Pending"} />
                </div>
                <p>{review.quote}</p>
                <div className="branch-proof-actions">
                  <Button variant="secondary" onClick={() => setReviewPublished(review, true)} disabled={review.published || saving === `review-${review.id}`}>Approve</Button>
                  <Button variant="ghost" onClick={() => setReviewPublished(review, false)} disabled={!review.published || saving === `review-${review.id}`}>Hide</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Reports" ? (
        <section className="card">
          <div className="card-head"><h3>Reports</h3><FileCheck2 size={20} /></div>
          <div className="ops-stat-grid">
            <StatCard label="Total bookings" value={String(bookings.length)} detail="For this branch" />
            <StatCard label="Outstanding" value={formatMoney(outstanding)} detail="Across branch bookings" />
            <StatCard label="Collected" value={formatMoney(paid)} detail="Paid branch payments" />
            <StatCard label="Pending proofs" value={String(pendingProofs)} detail="Needs review" />
          </div>
        </section>
      ) : null}

      {showTripModal ? (
        <div className="branch-modal-backdrop" role="presentation">
          <section className="branch-modal" role="dialog" aria-modal="true" aria-labelledby="branch-add-trip-title">
            <div className="card-head">
              <div>
                <h3 id="branch-add-trip-title">Add Trip</h3>
                <p>{profile?.cities?.name ?? "Assigned branch city"}</p>
              </div>
            </div>

            <div className="branch-modal-grid">
              <label className="branch-modal-full">
                Branch city
                <input value={profile?.cities?.name ?? ""} readOnly />
              </label>
              <label>
                Trip title
                <input value={tripForm.title} onChange={(event) => setTripFormValue("title", event.target.value)} placeholder="Johannesburg Weekend Escape" />
              </label>
              <label>
                Slug
                <input value={tripForm.slug} onChange={(event) => setTripFormValue("slug", event.target.value)} placeholder={tripForm.title ? slugify(tripForm.title) : "johannesburg-weekend-escape"} />
              </label>
              <label>
                Category
                <input value={tripForm.category} onChange={(event) => setTripFormValue("category", event.target.value)} placeholder="Weekend Trip" />
              </label>
              <label>
                Start date
                <input type="date" value={tripForm.start_date} onChange={(event) => setTripFormValue("start_date", event.target.value)} />
              </label>
              <label>
                Duration
                <input value={tripForm.duration} onChange={(event) => setTripFormValue("duration", event.target.value)} placeholder="3 days" />
              </label>
              <label>
                Meeting point
                <input value={tripForm.meeting_point} onChange={(event) => setTripFormValue("meeting_point", event.target.value)} placeholder="Main university pickup" />
              </label>
              <label>
                Price
                <input type="number" min="0" step="0.01" value={tripForm.price} onChange={(event) => setTripFormValue("price", event.target.value)} placeholder="3499" />
              </label>
              <label>
                Original price
                <input type="number" min="0" step="0.01" value={tripForm.original_price} onChange={(event) => setTripFormValue("original_price", event.target.value)} placeholder="3999" />
              </label>
              <label>
                Deposit
                <input type="number" min="0" step="0.01" value={tripForm.deposit} onChange={(event) => setTripFormValue("deposit", event.target.value)} placeholder="499" />
              </label>
              <label>
                Capacity
                <input type="number" min="1" value={tripForm.capacity} onChange={(event) => setTripFormValue("capacity", event.target.value)} placeholder="18" />
              </label>
              <label>
                Seats remaining
                <input type="number" min="0" value={tripForm.seats_remaining} onChange={(event) => setTripFormValue("seats_remaining", event.target.value)} placeholder={tripForm.capacity || "18"} />
              </label>
              <label className="branch-check">
                Special trip
                <input type="checkbox" checked={tripForm.is_special} onChange={(event) => setTripForm((current) => ({ ...current, is_special: event.target.checked }))} />
              </label>
              <label>
                Special collection
                <input
                  value={tripForm.special_collection_slug}
                  onChange={(event) => setTripFormValue("special_collection_slug", event.target.value)}
                  placeholder={tripForm.title ? `${slugify(tripForm.title)}-specials` : "winter-specials"}
                />
              </label>
              <label className="branch-modal-full">
                Summary
                <textarea value={tripForm.summary} onChange={(event) => setTripFormValue("summary", event.target.value)} rows={3} placeholder="A social escape with safe group transport." />
              </label>
            </div>

            <div className="branch-modal-actions">
              <button type="button" onClick={() => { setShowTripModal(false); resetTripForm(); }} disabled={Boolean(saving)}>Cancel</button>
              <button type="button" onClick={createTrip} disabled={saving === "trips-create"}>
                {saving === "trips-create" ? "Saving..." : "Add Trip"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </RoleShell>
  );
}
