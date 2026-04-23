import { BarChart3, Building2, CreditCard, FileCheck2, MessageSquare, Newspaper, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatDate, formatMoney } from "../../lib/data";
import { deriveTripStatus } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { Button } from "../../shared/components/Button";
import { StatCard } from "../../shared/components/StatCard";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { RoleShell } from "../../shared/layout/RoleShell";
import "./AdminScreen.css";

const adminTabs = ["Overview", "Bookings", "Customers", "Cities", "Trips", "Payments", "Inquiries", "Updates", "Reviews"];
const adminAssetBucket = "student-trip-assets";
const adminTabStorageKey = "student-trips:admin-tab";
const activeBookingStatuses = new Set(["Pending Payment", "Awaiting Proof", "Waitlisted", "Confirmed"]);
const payableBookingStatuses = new Set(["Pending Payment", "Awaiting Proof"]);

function getSavedAdminTab() {
  try {
    const savedTab = window.localStorage.getItem(adminTabStorageKey);
    return savedTab && adminTabs.includes(savedTab) ? savedTab : adminTabs[0];
  } catch {
    return adminTabs[0];
  }
}

type AdminProfile = {
  id: string;
  role: "customer" | "branch" | "admin";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  campus: string | null;
  organisation: string | null;
  profile_complete_percent: number | null;
  created_at: string;
};

type AdminCity = {
  id: string;
  slug: string;
  name: string;
  province: string | null;
  active: boolean;
  support_email: string | null;
  support_phone: string | null;
  image_url: string | null;
  tagline: string | null;
  trips?: { count: number }[] | null;
};

type AdminTrip = {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  summary: string | null;
  meeting_point: string | null;
  pickup_points: string[] | null;
  start_date: string;
  duration: string | null;
  price_cents: number;
  deposit_cents: number;
  capacity: number;
  seats_remaining: number;
  status: string;
  published: boolean;
  created_at: string;
  cities: { id: string | null; name: string | null } | null;
};

type AdminBooking = {
  id: string;
  user_id: string;
  booking_ref: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  outstanding_cents: number;
  created_at: string;
  trips: { title: string; cities?: { name: string | null } | null } | null;
};

type AdminPayment = {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
  bookings: { booking_ref: string; status: string; trips?: { title: string | null } | null } | null;
};

type AdminProof = {
  id: string;
  booking_id: string;
  file_path: string;
  file_name: string | null;
  amount_cents: number | null;
  approved: boolean | null;
  created_at: string;
  bookings: { booking_ref: string } | null;
};

type PartnerInquiry = {
  id: string;
  inquiry_type: string;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  campus: string | null;
  preferred_city: string | null;
  details: string | null;
  created_at: string;
};

type ContactInquiry = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  created_at: string;
};

type AdminUpdate = {
  id: string;
  title: string;
  body: string;
  published_on: string;
  published: boolean;
  created_at: string;
};

type AdminReview = {
  id: string;
  trip_id: string | null;
  author_name: string;
  rating: number;
  quote: string;
  published: boolean;
  created_at: string;
  trips: { title: string | null } | null;
};

type PendingDelete = {
  table: string;
  id: string;
  label: string;
};

function personName(profile: Pick<AdminProfile, "first_name" | "last_name" | "email"> | null) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return name || profile?.email || "Admin";
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="app-empty-state admin-empty">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminScreen() {
  const [activeTab, setActiveTabState] = useState(getSavedAdminTab);
  const [currentProfile, setCurrentProfile] = useState<AdminProfile | null>(null);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [cities, setCities] = useState<(AdminCity & { tripCount: number })[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [proofs, setProofs] = useState<AdminProof[]>([]);
  const [partnerInquiries, setPartnerInquiries] = useState<PartnerInquiry[]>([]);
  const [contactInquiries, setContactInquiries] = useState<ContactInquiry[]>([]);
  const [updates, setUpdates] = useState<AdminUpdate[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [editingValues, setEditingValues] = useState<Record<string, string | boolean>>({});
  const [showCityModal, setShowCityModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingCityId, setEditingCityId] = useState("");
  const [editingTripId, setEditingTripId] = useState("");
  const [editingReviewId, setEditingReviewId] = useState("");
  const [cityForm, setCityForm] = useState({
    name: "",
    slug: "",
    province: "",
    tagline: "",
    support_email: "",
    support_phone: "",
  });
  const [cityImageFile, setCityImageFile] = useState<File | null>(null);
  const [tripForm, setTripForm] = useState({
    city_id: "",
    title: "",
    slug: "",
    category: "",
    summary: "",
    meeting_point: "",
    pickup_points: [""],
    start_date: "",
    duration: "",
    price: "",
    deposit: "",
    capacity: "",
    seats_remaining: "",
  });
  const [tripImageFile, setTripImageFile] = useState<File | null>(null);
  const [reviewForm, setReviewForm] = useState({
    author_name: "",
    rating: "5",
    quote: "",
    trip_id: "",
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function setActiveTab(nextTab: string) {
    setActiveTabState(nextTab);
    try {
      window.localStorage.setItem(adminTabStorageKey, nextTab);
    } catch {
      // Keep tab navigation working when storage is unavailable.
    }
  }

  async function loadAdmin() {
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("Admin data is unavailable until Supabase is configured.");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const [
      currentProfileResult,
      profilesResult,
      cityResult,
      tripResult,
      bookingResult,
      paymentResult,
      proofResult,
      partnerResult,
      contactResult,
      updateResult,
      reviewResult,
    ] = await Promise.all([
      userId ? supabase.from("profiles").select("id,role,first_name,last_name,email,phone,campus,organisation,profile_complete_percent,created_at").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from("profiles").select("id,role,first_name,last_name,email,phone,campus,organisation,profile_complete_percent,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("cities").select("id,slug,name,province,active,support_email,support_phone,image_url,tagline,trips(count)").order("name"),
      supabase.from("trips").select("id,slug,title,category,image_url,summary,meeting_point,start_date,duration,price_cents,deposit_cents,capacity,seats_remaining,status,published,created_at,cities(id,name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("bookings").select("id,user_id,booking_ref,status,total_cents,paid_cents,outstanding_cents,created_at,trips(title,cities(name))").order("created_at", { ascending: false }).limit(100),
      supabase.from("payments").select("id,amount_cents,method,status,provider,provider_reference,paid_at,created_at,bookings(booking_ref,status,trips(title))").order("created_at", { ascending: false }).limit(100),
      supabase.from("payment_proofs").select("id,booking_id,file_path,file_name,amount_cents,approved,created_at,bookings(booking_ref)").order("created_at", { ascending: false }).limit(100),
      supabase.from("partner_inquiries").select("id,inquiry_type,name,email,phone,organisation,campus,preferred_city,details,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("contact_inquiries").select("id,name,email,phone,subject,message,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("updates").select("id,title,body,published_on,published,created_at").order("published_on", { ascending: false }).limit(100),
      supabase.from("reviews").select("id,trip_id,author_name,rating,quote,published,created_at,trips(title)").order("created_at", { ascending: false }).limit(100),
    ]);

    const firstError =
      currentProfileResult.error ??
      profilesResult.error ??
      cityResult.error ??
      tripResult.error ??
      bookingResult.error ??
      paymentResult.error ??
      proofResult.error ??
      partnerResult.error ??
      contactResult.error ??
      updateResult.error ??
      reviewResult.error;

    if (firstError) {
      setError(firstError.message);
    }

    setCurrentProfile((currentProfileResult.data as AdminProfile | null) ?? null);
    setProfiles((profilesResult.data as AdminProfile[] | null) ?? []);
    setCities(((cityResult.data as unknown as AdminCity[] | null) ?? []).map((city) => ({ ...city, tripCount: city.trips?.[0]?.count ?? 0 })));
    setTrips((tripResult.data as unknown as AdminTrip[] | null) ?? []);
    setBookings((bookingResult.data as unknown as AdminBooking[] | null) ?? []);
    setPayments((paymentResult.data as unknown as AdminPayment[] | null) ?? []);
    setProofs((proofResult.data as unknown as AdminProof[] | null) ?? []);
    setPartnerInquiries((partnerResult.data as PartnerInquiry[] | null) ?? []);
    setContactInquiries((contactResult.data as ContactInquiry[] | null) ?? []);
    setUpdates((updateResult.data as AdminUpdate[] | null) ?? []);
    setReviews((reviewResult.data as unknown as AdminReview[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAdmin();
  }, []);

  async function updateRecord(table: string, id: string, values: Record<string, unknown>) {
    if (!supabase) return;
    setSaving(`${table}-${id}`);
    const { error: updateError } = await supabase.from(table).update(values).eq("id", id);
    if (updateError) {
      setError(updateError.message);
    } else {
      await loadAdmin();
      setSuccessMessage("Changes saved successfully.");
    }
    setSaving("");
  }

  function deleteRecord(table: string, id: string, label: string) {
    setPendingDelete({ table, id, label });
  }

  async function confirmDeleteRecord() {
    if (!supabase) return;
    if (!pendingDelete) return;

    setSaving(`${pendingDelete.table}-delete-${pendingDelete.id}`);
    const { error: deleteError } = await supabase.from(pendingDelete.table).delete().eq("id", pendingDelete.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      if (editingKey.endsWith(pendingDelete.id)) {
        setEditingKey("");
        setEditingValues({});
      }
      await loadAdmin();
      setSuccessMessage(`${pendingDelete.label} deleted successfully.`);
      setPendingDelete(null);
    }
    setSaving("");
  }

  async function updateProfileRole(id: string, role: AdminProfile["role"]) {
    if (!supabase) return;
    setSaving(`profiles-${id}`);
    const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
    } else {
      await loadAdmin();
      setSuccessMessage("Role updated successfully.");
    }
    setSaving("");
  }

  function startEdit(key: string, values: Record<string, string | boolean>) {
    setEditingKey(key);
    setEditingValues(values);
  }

  function cancelEdit() {
    setEditingKey("");
    setEditingValues({});
  }

  function setEditingValue(field: string, value: string | boolean) {
    setEditingValues((current) => ({ ...current, [field]: value }));
  }

  function setCityFormValue(field: keyof typeof cityForm, value: string | boolean) {
    setCityForm((current) => ({ ...current, [field]: value }));
  }

  function resetCityForm() {
    setEditingCityId("");
    setCityForm({
      name: "",
      slug: "",
      province: "",
      tagline: "",
      support_email: "",
      support_phone: "",
    });
    setCityImageFile(null);
  }

  function setTripFormValue(field: keyof typeof tripForm, value: string | boolean) {
    setTripForm((current) => ({ ...current, [field]: value }));
  }

  function resetTripForm() {
    setEditingTripId("");
    setTripForm({
      city_id: "",
      title: "",
      slug: "",
      category: "",
      summary: "",
      meeting_point: "",
      pickup_points: [""],
      start_date: "",
      duration: "",
      price: "",
      deposit: "",
      capacity: "",
      seats_remaining: "",
    });
    setTripImageFile(null);
  }

  function setReviewFormValue(field: keyof typeof reviewForm, value: string | boolean) {
    setReviewForm((current) => ({ ...current, [field]: value }));
  }

  function resetReviewForm() {
    setEditingReviewId("");
    setReviewForm({
      author_name: "",
      rating: "5",
      quote: "",
      trip_id: "",
    });
  }

  function openCityForm(city?: AdminCity) {
    if (city) {
      setEditingCityId(city.id);
      setCityForm({
        name: city.name,
        slug: city.slug,
        province: city.province ?? "",
        tagline: city.tagline ?? "",
        support_email: city.support_email ?? "",
        support_phone: city.support_phone ?? "",
      });
    } else {
      resetCityForm();
    }
    setCityImageFile(null);
    setShowCityModal(true);
  }

  function openTripForm(trip?: AdminTrip) {
    if (trip) {
      setEditingTripId(trip.id);
      setTripForm({
        city_id: trip.cities?.id ?? "",
        title: trip.title,
        slug: trip.slug,
        category: trip.category,
        summary: trip.summary ?? "",
        meeting_point: trip.meeting_point ?? "",
        pickup_points: trip.pickup_points?.length ? trip.pickup_points : [trip.meeting_point ?? ""],
        start_date: trip.start_date,
        duration: trip.duration ?? "",
        price: String(trip.price_cents / 100),
        deposit: String(trip.deposit_cents / 100),
        capacity: String(trip.capacity),
        seats_remaining: String(trip.seats_remaining),
      });
    } else {
      resetTripForm();
    }
    setTripImageFile(null);
    setShowTripModal(true);
  }

  function setTripPickupPoint(index: number, value: string) {
    setTripForm((current) => ({
      ...current,
      pickup_points: current.pickup_points.map((point, pointIndex) => (pointIndex === index ? value : point)),
    }));
  }

  function addTripPickupPoint() {
    setTripForm((current) => ({ ...current, pickup_points: [...current.pickup_points, ""] }));
  }

  function removeTripPickupPoint(index: number) {
    setTripForm((current) => ({
      ...current,
      pickup_points: current.pickup_points.length > 1 ? current.pickup_points.filter((_, pointIndex) => pointIndex !== index) : [""],
    }));
  }

  function openReviewForm(review?: AdminReview) {
    if (review) {
      setEditingReviewId(review.id);
      setReviewForm({
        author_name: review.author_name,
        rating: String(review.rating),
        quote: review.quote,
        trip_id: review.trip_id ?? "",
      });
    } else {
      resetReviewForm();
    }
    setShowReviewModal(true);
  }

  async function uploadAdminImage(folder: "cities" | "trips", slug: string, file: File) {
    if (!supabase) return null;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return null;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${folder}/${slug}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(adminAssetBucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(adminAssetBucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function createCity() {
    if (!supabase) return;

    const wasEditing = Boolean(editingCityId);
    const name = cityForm.name.trim();
    const slug = (cityForm.slug.trim() || slugify(name)).trim();

    if (!name || !slug) {
      setError("City name and slug are required.");
      return;
    }

    setSaving(editingCityId ? `cities-${editingCityId}` : "cities-create");
    const imageUrl = cityImageFile ? await uploadAdminImage("cities", slug, cityImageFile) : null;
    if (cityImageFile && !imageUrl) {
      setSaving("");
      return;
    }

    const cityValues = {
      name,
      slug,
      province: cityForm.province.trim() || null,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      tagline: cityForm.tagline.trim() || null,
      support_email: cityForm.support_email.trim() || null,
      support_phone: cityForm.support_phone.trim() || null,
      active: true,
    };

    const { error: insertError } = editingCityId
      ? await supabase.from("cities").update(cityValues).eq("id", editingCityId)
      : await supabase.from("cities").insert(cityValues);

    if (insertError) {
      setError(insertError.message);
    } else {
      setShowCityModal(false);
      resetCityForm();
      await loadAdmin();
      setSuccessMessage(wasEditing ? "City updated successfully." : "City added successfully.");
    }
    setSaving("");
  }

  async function createTrip() {
    if (!supabase) return;

    const wasEditing = Boolean(editingTripId);
    const title = tripForm.title.trim();
    const slug = (tripForm.slug.trim() || slugify(title)).trim();
    const priceCents = Math.round(Number(tripForm.price) * 100);
    const depositCents = Math.round(Number(tripForm.deposit || "0") * 100);
    const capacity = Number.parseInt(tripForm.capacity, 10);
    const seatsRemaining = Number.parseInt(tripForm.seats_remaining || tripForm.capacity, 10);
    const pickupPoints = tripForm.pickup_points.map((point) => point.trim()).filter(Boolean);

    if (!title || !slug || !tripForm.category.trim() || !tripForm.start_date || (!editingTripId && !tripForm.city_id)) {
      setError("Trip title, slug, city, category, and start date are required.");
      return;
    }

    if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(seatsRemaining) || seatsRemaining < 0) {
      setError("Trip price, capacity, and seats must be valid numbers.");
      return;
    }

    setSaving(editingTripId ? `trips-${editingTripId}` : "trips-create");
    const imageUrl = tripImageFile ? await uploadAdminImage("trips", slug, tripImageFile) : null;
    if (tripImageFile && !imageUrl) {
      setSaving("");
      return;
    }

    const tripValues = {
      ...(!editingTripId || tripForm.city_id ? { city_id: tripForm.city_id } : {}),
      title,
      slug,
      category: tripForm.category.trim(),
      ...(imageUrl ? { image_url: imageUrl } : {}),
      summary: tripForm.summary.trim() || null,
      meeting_point: pickupPoints[0] || tripForm.meeting_point.trim() || null,
      pickup_points: pickupPoints,
      start_date: tripForm.start_date,
      duration: tripForm.duration.trim() || null,
      price_cents: priceCents,
      deposit_cents: depositCents,
      capacity,
      seats_remaining: Math.min(seatsRemaining, capacity),
      status: "OPEN",
      featured: false,
      published: true,
      tags: [],
    };

    const { error: insertError } = editingTripId
      ? await supabase.from("trips").update(tripValues).eq("id", editingTripId)
      : await supabase.from("trips").insert(tripValues);

    if (insertError) {
      if (insertError.message.toLowerCase().includes("pickup_points")) {
        const { pickup_points: _pickupPoints, ...legacyTripValues } = tripValues;
        const { error: legacyError } = editingTripId
          ? await supabase.from("trips").update(legacyTripValues).eq("id", editingTripId)
          : await supabase.from("trips").insert(legacyTripValues);

        if (legacyError) {
          setError(legacyError.message);
        } else {
          setShowTripModal(false);
          resetTripForm();
          await loadAdmin();
          setSuccessMessage(wasEditing ? "Trip updated successfully." : "Trip added successfully.");
        }
      } else {
        setError(insertError.message);
      }
    } else {
      setShowTripModal(false);
      resetTripForm();
      await loadAdmin();
      setSuccessMessage(wasEditing ? "Trip updated successfully." : "Trip added successfully.");
    }
    setSaving("");
  }

  async function createReview() {
    if (!supabase) return;

    const wasEditing = Boolean(editingReviewId);
    const authorName = reviewForm.author_name.trim();
    const quote = reviewForm.quote.trim();
    const rating = Number.parseInt(reviewForm.rating, 10);

    if (!authorName || !quote) {
      setError("Review author and quote are required.");
      return;
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setError("Review rating must be between 1 and 5.");
      return;
    }

    setSaving(editingReviewId ? `reviews-${editingReviewId}` : "reviews-create");
    const reviewValues = {
      author_name: authorName,
      rating,
      quote,
      trip_id: reviewForm.trip_id || null,
      published: true,
    };

    const { error: insertError } = editingReviewId
      ? await supabase.from("reviews").update(reviewValues).eq("id", editingReviewId)
      : await supabase.from("reviews").insert(reviewValues);

    if (insertError) {
      setError(insertError.message);
    } else {
      setShowReviewModal(false);
      resetReviewForm();
      await loadAdmin();
      setSuccessMessage(wasEditing ? "Review updated successfully." : "Review added successfully.");
    }
    setSaving("");
  }

  async function saveTrip(id: string) {
    await updateRecord("trips", id, {
      title: String(editingValues.title ?? "").trim(),
      category: String(editingValues.category ?? "").trim(),
      start_date: String(editingValues.start_date ?? ""),
      published: Boolean(editingValues.published),
    });
    cancelEdit();
  }

  async function saveBooking(id: string) {
    await updateRecord("bookings", id, {
      status: String(editingValues.status ?? "Pending Payment"),
    });
    cancelEdit();
  }

  async function reviewPaymentProof(proof: AdminProof, approved: boolean) {
    if (!supabase) return;
    if (proof.approved !== null) return;

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
      setError(proofError.message);
      return;
    }

    if (!approved) {
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ status: "Pending Payment" })
        .eq("id", proof.booking_id);

      if (bookingError) {
        setError(bookingError.message);
      } else {
        await loadAdmin();
        setSuccessMessage("Payment proof rejected.");
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
      setError(bookingLoadError?.message ?? "Could not load booking for this proof.");
      return;
    }

    const nextPaid = Math.min((booking.paid_cents ?? 0) + amountPaid, booking.total_cents ?? amountPaid);
    const confirmThreshold = booking.deposit_cents > 0 ? Math.min(booking.deposit_cents, booking.total_cents) : booking.total_cents;
    const nextStatus = nextPaid >= confirmThreshold ? "Confirmed" : "Pending Payment";

    const { error: paymentError } = await supabase
      .from("payments")
      .update({ status: "Paid", paid_at: reviewedAt })
      .eq("booking_id", proof.booking_id)
      .eq("status", "Pending");

    if (paymentError) {
      setSaving("");
      setError(paymentError.message);
      return;
    }

    const { error: bookingError } = await supabase
      .from("bookings")
      .update({ paid_cents: nextPaid, status: nextStatus })
      .eq("id", proof.booking_id);

    if (bookingError) {
      setError(bookingError.message);
    } else {
      await loadAdmin();
      setSuccessMessage("Payment proof approved and booking updated.");
    }
    setSaving("");
  }

  async function openPaymentProof(proof: AdminProof) {
    if (!supabase) return;

    setSaving(`payment-proof-view-${proof.id}`);
    setError("");

    const { data, error: signedUrlError } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof.file_path, 60 * 5);

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message ?? "Could not open payment proof.");
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    setSaving("");
  }

  async function saveProfile(id: string) {
    await updateRecord("profiles", id, {
      first_name: String(editingValues.first_name ?? "").trim() || null,
      last_name: String(editingValues.last_name ?? "").trim() || null,
      phone: String(editingValues.phone ?? "").trim() || null,
      campus: String(editingValues.campus ?? "").trim() || null,
      organisation: String(editingValues.organisation ?? "").trim() || null,
      role: String(editingValues.role ?? "customer"),
    });
    cancelEdit();
  }

  async function saveCity(id: string) {
    await updateRecord("cities", id, {
      name: String(editingValues.name ?? "").trim(),
      province: String(editingValues.province ?? "").trim() || null,
      support_email: String(editingValues.support_email ?? "").trim() || null,
      support_phone: String(editingValues.support_phone ?? "").trim() || null,
      active: Boolean(editingValues.active),
    });
    cancelEdit();
  }

  async function saveUpdate(id: string) {
    await updateRecord("updates", id, {
      title: String(editingValues.title ?? "").trim(),
      body: String(editingValues.body ?? "").trim(),
      published_on: String(editingValues.published_on ?? ""),
      published: Boolean(editingValues.published),
    });
    cancelEdit();
  }

  async function saveReview(id: string) {
    await updateRecord("reviews", id, {
      author_name: String(editingValues.author_name ?? "").trim(),
      rating: Number.parseInt(String(editingValues.rating ?? "5"), 10),
      quote: String(editingValues.quote ?? "").trim(),
      trip_id: String(editingValues.trip_id ?? "") || null,
      published: Boolean(editingValues.published),
    });
    cancelEdit();
  }

  const activeBookings = useMemo(() => bookings.filter((booking) => activeBookingStatuses.has(booking.status)), [bookings]);
  const paid = useMemo(() => bookings.reduce((sum, booking) => sum + booking.paid_cents, 0), [bookings]);
  const outstanding = useMemo(() => bookings.reduce((sum, booking) => (payableBookingStatuses.has(booking.status) ? sum + booking.outstanding_cents : sum), 0), [bookings]);
  const pendingProofs = proofs.filter((proof) => proof.approved === null).length;
  const unpublishedTrips = trips.filter((trip) => !trip.published).length;
  const nearlyFull = trips.filter((trip) => deriveTripStatus(trip.capacity, trip.seats_remaining) === "NEARLY_FULL").length;
  const profilesById = useMemo(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const maxCityTripCount = useMemo(() => Math.max(...cities.map((city) => city.tripCount), 1), [cities]);
  const activePayments = useMemo(
    () => payments.filter((payment) => !payment.bookings?.status || activeBookingStatuses.has(payment.bookings.status)),
    [payments],
  );

  return (
    <RoleShell
      scope="admin"
      tabs={adminTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userName={personName(currentProfile)}
      userRole="Admin"
    >
      {loading ? <section className="card app-empty-state"><ThemeLoader label="Loading admin data" /><p>Loading admin data...</p></section> : null}
      {error && !loading ? <section className="card app-empty-state"><h2>Admin data unavailable</h2><p>{error}</p><Button onClick={loadAdmin}>Try again</Button></section> : null}

      {!loading && !error && activeTab === "Overview" ? (
        <>
          <div className="ops-stat-grid">
            <StatCard label="Bookings" value={String(activeBookings.length)} detail={`${formatMoney(outstanding)} outstanding`} />
            <StatCard label="Revenue" value={formatMoney(paid)} detail="Collected payments" />
            <StatCard label="Trips" value={String(trips.length)} detail={`${unpublishedTrips} unpublished - ${nearlyFull} nearly full`} />
            <StatCard label="Action queue" value={String(pendingProofs)} detail="Payment proofs pending" />
          </div>
          <div className="ops-grid">
            <section className="card chart-card">
              <div className="card-head"><h3>Trips by city</h3><BarChart3 size={20} /></div>
              <div className="admin-bar-list">
                {cities.length === 0 ? <EmptyState title="No cities yet" detail="Add cities in Supabase to start grouping departures." /> : null}
                {cities.map((city) => (
                  <article key={city.id} className="admin-bar-item">
                    <strong>{city.tripCount}</strong>
                    <div className="admin-bar-track">
                      <i style={{ height: `${Math.max((city.tripCount / maxCityTripCount) * 100, city.tripCount > 0 ? 12 : 0)}%` }} />
                    </div>
                    <span>{city.name}</span>
                  </article>
                ))}
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h3>Needs attention</h3><FileCheck2 size={20} /></div>
              <div className="stack">
                {pendingProofs === 0 && bookings.length === 0 ? <EmptyState title="Nothing urgent" detail="New payment proofs and bookings will appear here." /> : null}
                {proofs.filter((proof) => proof.approved === null).slice(0, 5).map((proof) => (
                  <article key={proof.id} className="list-item">
                    <div><strong>{proof.bookings?.booking_ref ?? "Proof"}</strong><span>{proof.file_name ?? "Uploaded proof"} - awaiting review</span></div>
                    <StatusBadge status="Pending" />
                  </article>
                ))}
                {bookings.slice(0, 5).map((booking) => (
                  <article key={booking.id} className="list-item">
                    <div><strong>{booking.booking_ref}</strong><span>{booking.trips?.title ?? "Trip"} - {formatMoney(booking.outstanding_cents)} outstanding</span></div>
                    <StatusBadge status={booking.status} />
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
            <Button onClick={() => openTripForm()}>Add Trip</Button>
          </div>
          <div className="admin-data-table admin-data-table-trips">
            <div className="admin-table-head admin-table-row-trip">
              <span>Trip</span>
              <span>Schedule</span>
              <span>Price</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {trips.length === 0 ? <EmptyState title="No trips yet" detail="Published and draft departures will appear here." /> : null}
            {trips.map((trip) => (
              editingKey === `trip-${trip.id}` ? (
                <article key={trip.id} className="admin-table-row admin-table-row-trip">
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.title ?? "")} onChange={(event) => setEditingValue("title", event.target.value)} />
                    <input value={String(editingValues.category ?? "")} onChange={(event) => setEditingValue("category", event.target.value)} />
                  </div>
                  <div className="admin-edit-stack">
                    <input type="date" value={String(editingValues.start_date ?? "")} onChange={(event) => setEditingValue("start_date", event.target.value)} />
                    <span>{trip.cities?.name ?? "No city"} - {trip.seats_remaining}/{trip.capacity} seats</span>
                  </div>
                  <strong>{formatMoney(trip.price_cents)}</strong>
                  <div className="admin-edit-stack">
                    <StatusBadge status={deriveTripStatus(trip.capacity, trip.seats_remaining)} />
                    <label className="admin-check"><input type="checkbox" checked={Boolean(editingValues.published)} onChange={(event) => setEditingValue("published", event.target.checked)} /> Published</label>
                  </div>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveTrip(trip.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("trips", trip.id, trip.title)}>Delete</Button>
                  </div>
                </article>
              ) : (
                <article key={trip.id} className="admin-table-row admin-table-row-trip">
                  <div><strong>{trip.title}</strong><span>{trip.cities?.name ?? "No city"} - {trip.category}</span></div>
                  <div><strong>{formatDate(trip.start_date)}</strong><span>{trip.seats_remaining}/{trip.capacity} seats</span></div>
                  <strong>{formatMoney(trip.price_cents)}</strong>
                  <StatusBadge status={trip.published ? deriveTripStatus(trip.capacity, trip.seats_remaining) : "Draft"} />
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => openTripForm(trip)}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("trips", trip.id, trip.title)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Bookings" ? (
        <section className="card">
          <div className="card-head"><h3>Bookings</h3><Users size={20} /></div>
          <div className="admin-data-table admin-data-table-bookings">
            <div className="admin-table-head admin-table-row-booking">
              <span>Booking</span>
              <span>Customer</span>
              <span>Payment</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {bookings.length === 0 ? <EmptyState title="No bookings yet" detail="Customer bookings will appear here as soon as they are created." /> : null}
            {bookings.map((booking) => (
              editingKey === `booking-${booking.id}` ? (
                <article key={booking.id} className="admin-table-row admin-table-row-booking">
                  <div><strong>{booking.booking_ref}</strong><span>{booking.trips?.title ?? "Trip"}</span></div>
                  <div><strong>{personName(profilesById[booking.user_id] ?? null)}</strong><span>{profilesById[booking.user_id]?.email ?? "No email"}</span></div>
                  <div><strong>{formatMoney(booking.total_cents)}</strong><span>{formatMoney(booking.outstanding_cents)} outstanding</span></div>
                  <select value={String(editingValues.status ?? booking.status)} onChange={(event) => setEditingValue("status", event.target.value)}>
                    <option value="Pending Payment">Pending Payment</option>
                    <option value="Awaiting Proof">Awaiting Proof</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Waitlisted">Waitlisted</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Refund Pending">Refund Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveBooking(booking.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("bookings", booking.id, booking.booking_ref)}>Delete</Button>
                  </div>
                </article>
              ) : (
                <article key={booking.id} className="admin-table-row admin-table-row-booking">
                  <div><strong>{booking.booking_ref}</strong><span>{booking.trips?.title ?? "Trip"}</span></div>
                  <div><strong>{personName(profilesById[booking.user_id] ?? null)}</strong><span>{profilesById[booking.user_id]?.email ?? "No email"}</span></div>
                  <div><strong>{formatMoney(booking.total_cents)}</strong><span>{formatMoney(booking.outstanding_cents)} outstanding</span></div>
                  <StatusBadge status={booking.status} />
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => startEdit(`booking-${booking.id}`, { status: booking.status })}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("bookings", booking.id, booking.booking_ref)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Customers" ? (
        <section className="card">
          <div className="card-head"><h3>Customers and staff</h3><Users size={20} /></div>
          <div className="admin-data-table admin-data-table-customers">
            <div className="admin-table-head admin-table-row-customer">
              <span>Name</span>
              <span>Contact</span>
              <span>Campus</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            {profiles.length === 0 ? <EmptyState title="No users yet" detail="Signed-up users will appear here." /> : null}
            {profiles.map((profile) => (
              editingKey === `profile-${profile.id}` ? (
                <article key={profile.id} className="admin-table-row admin-table-row-customer">
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.first_name ?? "")} onChange={(event) => setEditingValue("first_name", event.target.value)} placeholder="First name" />
                    <input value={String(editingValues.last_name ?? "")} onChange={(event) => setEditingValue("last_name", event.target.value)} placeholder="Last name" />
                  </div>
                  <div className="admin-edit-stack">
                    <span>{profile.email ?? "No email"}</span>
                    <input value={String(editingValues.phone ?? "")} onChange={(event) => setEditingValue("phone", event.target.value)} placeholder="Phone" />
                  </div>
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.campus ?? "")} onChange={(event) => setEditingValue("campus", event.target.value)} placeholder="Campus" />
                    <input value={String(editingValues.organisation ?? "")} onChange={(event) => setEditingValue("organisation", event.target.value)} placeholder="Organisation" />
                  </div>
                  <select value={String(editingValues.role ?? profile.role)} onChange={(event) => setEditingValue("role", event.target.value)}>
                    <option value="customer">customer</option>
                    <option value="branch">branch</option>
                    <option value="admin">admin</option>
                  </select>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveProfile(profile.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    {profile.id !== currentProfile?.id ? <Button variant="ghost" onClick={() => deleteRecord("profiles", profile.id, personName(profile))}>Delete</Button> : null}
                  </div>
                </article>
              ) : (
                <article key={profile.id} className="admin-table-row admin-table-row-customer">
                  <div><strong>{personName(profile)}</strong><span>{profile.profile_complete_percent ?? 0}% complete</span></div>
                  <div><strong>{profile.email ?? "No email"}</strong><span>{profile.phone ?? "No phone"}</span></div>
                  <div><strong>{profile.campus ?? "No campus"}</strong><span>{profile.organisation ?? "No organisation"}</span></div>
                  <StatusBadge status={profile.role} />
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => startEdit(`profile-${profile.id}`, { first_name: profile.first_name ?? "", last_name: profile.last_name ?? "", phone: profile.phone ?? "", campus: profile.campus ?? "", organisation: profile.organisation ?? "", role: profile.role })}>Edit</Button>
                    {profile.id !== currentProfile?.id ? <Button variant="ghost" onClick={() => deleteRecord("profiles", profile.id, personName(profile))}>Delete</Button> : null}
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Payments" ? (
        <div className="admin-payments-layout">
          <section className="card">
            <div className="card-head">
              <div>
                <h3>Payments</h3>
                <p>Track payment records created from customer bookings.</p>
              </div>
              <CreditCard size={20} />
            </div>
            <div className="admin-payment-list">
              {activePayments.length === 0 ? <EmptyState title="No active payments" detail="Open customer payment records will appear here." /> : null}
              {activePayments.map((payment) => (
                <article key={payment.id} className="admin-payment-row">
                  <div className="admin-payment-title">
                    <strong>{payment.bookings?.booking_ref ?? "Payment"}</strong>
                    <span>{payment.bookings?.trips?.title ?? payment.provider ?? payment.method}</span>
                  </div>
                  <dl className="admin-payment-meta">
                    <div><dt>Amount</dt><dd>{formatMoney(payment.amount_cents)}</dd></div>
                    <div><dt>Reference</dt><dd>{payment.provider_reference ?? "Not supplied"}</dd></div>
                    <div><dt>Booking</dt><dd>{payment.bookings?.status ?? "No booking"}</dd></div>
                  </dl>
                  <div className="admin-payment-status">
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="admin-payment-actions">
                    <Button variant="secondary" onClick={() => updateRecord("payments", payment.id, { status: "Paid", paid_at: new Date().toISOString() })}>Paid</Button>
                    <Button variant="ghost" onClick={() => updateRecord("payments", payment.id, { status: "Failed" })}>Failed</Button>
                    <Button variant="ghost" onClick={() => updateRecord("payments", payment.id, { status: "Refunded" })}>Refunded</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h3>Proof queue</h3>
                <p>Review uploaded EFT/manual payment proofs before confirming bookings.</p>
              </div>
              <FileCheck2 size={20} />
            </div>
            <div className="admin-proof-list">
              {proofs.length === 0 ? <EmptyState title="No proofs uploaded" detail="Customer EFT or manual payment proofs will appear here." /> : null}
              {proofs.map((proof) => (
                <article key={proof.id} className="admin-proof-row">
                  <div className="admin-proof-head">
                    <div>
                      <strong>{proof.bookings?.booking_ref ?? "Proof"}</strong>
                      <span>{proof.file_name ?? "Uploaded file"}</span>
                    </div>
                    <StatusBadge status={proof.approved === null ? "Pending" : proof.approved ? "Approved" : "Rejected"} />
                  </div>
                  <dl className="admin-payment-meta">
                    <div><dt>Amount</dt><dd>{proof.amount_cents ? formatMoney(proof.amount_cents) : "Not captured"}</dd></div>
                    <div><dt>Uploaded</dt><dd>{formatDate(proof.created_at)}</dd></div>
                    <div><dt>Review state</dt><dd>{proof.approved === null ? "Waiting for admin review" : proof.approved ? "Confirmed" : "Rejected"}</dd></div>
                  </dl>
                  <div className="admin-proof-actions">
                    <Button variant="ghost" onClick={() => openPaymentProof(proof)} disabled={saving === `payment-proof-view-${proof.id}`}>View</Button>
                    <Button variant="secondary" onClick={() => reviewPaymentProof(proof, true)} disabled={proof.approved !== null || saving === `payment-proof-${proof.id}`}>Confirm</Button>
                    <Button variant="ghost" onClick={() => reviewPaymentProof(proof, false)} disabled={proof.approved !== null || saving === `payment-proof-${proof.id}`}>Reject</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && !error && activeTab === "Inquiries" ? (
        <div className="ops-grid">
          <section className="card">
            <div className="card-head"><h3>Partner inquiries</h3><Building2 size={20} /></div>
            <div className="admin-table">
              {partnerInquiries.length === 0 ? <EmptyState title="No partner inquiries" detail="Campus, society, and partner messages will appear here." /> : null}
              {partnerInquiries.map((inquiry) => (
                <article key={inquiry.id} className="admin-row compact">
                  <div><strong>{inquiry.name}</strong><span>{inquiry.inquiry_type} - {inquiry.organisation ?? inquiry.campus ?? "No organisation"}</span></div>
                  <div><span>{inquiry.preferred_city ?? "Any city"}</span><span>{formatDate(inquiry.created_at)}</span></div>
                  <a href={`mailto:${inquiry.email}`}>Email</a>
                  {inquiry.phone ? <a href={`https://wa.me/${inquiry.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a> : <span>No phone</span>}
                </article>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3>Contact messages</h3><MessageSquare size={20} /></div>
            <div className="admin-table">
              {contactInquiries.length === 0 ? <EmptyState title="No contact messages" detail="Support messages will appear here." /> : null}
              {contactInquiries.map((inquiry) => (
                <article key={inquiry.id} className="admin-row compact">
                  <div><strong>{inquiry.name ?? inquiry.email}</strong><span>{inquiry.subject ?? inquiry.message}</span></div>
                  <div><span>{inquiry.phone ?? "No phone"}</span><span>{formatDate(inquiry.created_at)}</span></div>
                  <a href={`mailto:${inquiry.email}`}>Email</a>
                  {inquiry.phone ? <a href={`https://wa.me/${inquiry.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a> : <span>No phone</span>}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && !error && activeTab === "Cities" ? (
        <section className="card">
          <div className="card-head">
            <h3>Cities</h3>
            <Button onClick={() => openCityForm()}>Add City</Button>
          </div>
          <div className="admin-data-table admin-data-table-cities">
            <div className="admin-table-head admin-table-row-city">
              <span>City</span>
              <span>Province</span>
              <span>Support</span>
              <span>Trips</span>
              <span>Actions</span>
            </div>
            {cities.length === 0 ? <EmptyState title="No cities yet" detail="City records will appear here." /> : null}
            {cities.map((city) => (
              editingKey === `city-${city.id}` ? (
                <article key={city.id} className="admin-table-row admin-table-row-city">
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.name ?? "")} onChange={(event) => setEditingValue("name", event.target.value)} />
                    <span>{city.slug}</span>
                  </div>
                  <input value={String(editingValues.province ?? "")} onChange={(event) => setEditingValue("province", event.target.value)} placeholder="Province" />
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.support_email ?? "")} onChange={(event) => setEditingValue("support_email", event.target.value)} placeholder="Support email" />
                    <input value={String(editingValues.support_phone ?? "")} onChange={(event) => setEditingValue("support_phone", event.target.value)} placeholder="Support phone" />
                  </div>
                  <label className="admin-check"><input type="checkbox" checked={Boolean(editingValues.active)} onChange={(event) => setEditingValue("active", event.target.checked)} /> Active</label>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveCity(city.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("cities", city.id, city.name)}>Delete</Button>
                  </div>
                </article>
              ) : (
                <article key={city.id} className="admin-table-row admin-table-row-city">
                  <div><strong>{city.name}</strong><span>{city.slug}</span></div>
                  <div><strong>{city.province ?? "No province"}</strong><span>{city.active ? "Active" : "Inactive"}</span></div>
                  <div><strong>{city.support_email ?? "No support email"}</strong><span>{city.support_phone ?? "No support phone"}</span></div>
                  <strong>{city.tripCount}</strong>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => openCityForm(city)}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("cities", city.id, city.name)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {showCityModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-city-title">
            <div className="card-head">
              <div>
                <h3 id="add-city-title">{editingCityId ? "Edit City" : "Add City"}</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label>
                City name
                <input value={cityForm.name} onChange={(event) => setCityFormValue("name", event.target.value)} placeholder="Cape Town" />
              </label>
              <label>
                Slug
                <input value={cityForm.slug} onChange={(event) => setCityFormValue("slug", event.target.value)} placeholder={cityForm.name ? slugify(cityForm.name) : "cape-town"} />
              </label>
              <label>
                Province
                <input value={cityForm.province} onChange={(event) => setCityFormValue("province", event.target.value)} placeholder="Western Cape" />
              </label>
              <label>
                Support email
                <input value={cityForm.support_email} onChange={(event) => setCityFormValue("support_email", event.target.value)} placeholder="cpt@studenttrips.co.za" />
              </label>
              <label>
                Support phone
                <input value={cityForm.support_phone} onChange={(event) => setCityFormValue("support_phone", event.target.value)} placeholder="+27 79 707 5710" />
              </label>
              <label className="admin-upload-field">
                City image
                <span className="admin-upload-box">
                  <input type="file" accept="image/*" onChange={(event) => setCityImageFile(event.target.files?.[0] ?? null)} />
                  <span className="admin-upload-button">Choose Image</span>
                  <span className="admin-upload-name">{cityImageFile?.name ?? "No image selected"}</span>
                </span>
              </label>
              <label className="admin-modal-full">
                Tagline
                <textarea value={cityForm.tagline} onChange={(event) => setCityFormValue("tagline", event.target.value)} rows={3} placeholder="Coastlines, mountains, markets, and group energy." />
              </label>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowCityModal(false); resetCityForm(); }}>Cancel</Button>
              <Button onClick={createCity} disabled={saving === "cities-create" || saving === `cities-${editingCityId}`}>
                {saving === "cities-create" || saving === `cities-${editingCityId}` ? "Saving..." : editingCityId ? "Save City" : "Add City"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {showTripModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-trip-title">
            <div className="card-head">
              <div>
                <h3 id="add-trip-title">{editingTripId ? "Edit Trip" : "Add Trip"}</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label>
                Trip title
                <input value={tripForm.title} onChange={(event) => setTripFormValue("title", event.target.value)} placeholder="Cape Town Coastal Weekender" />
              </label>
              <label>
                Slug
                <input value={tripForm.slug} onChange={(event) => setTripFormValue("slug", event.target.value)} placeholder={tripForm.title ? slugify(tripForm.title) : "cape-town-coastal-weekender"} />
              </label>
              <label>
                City
                <select value={tripForm.city_id} onChange={(event) => setTripFormValue("city_id", event.target.value)}>
                  <option value="">Choose city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
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
                Price
                <input type="number" min="0" step="0.01" value={tripForm.price} onChange={(event) => setTripFormValue("price", event.target.value)} placeholder="3499" />
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
              <label className="admin-upload-field">
                Trip image
                <span className="admin-upload-box">
                  <input type="file" accept="image/*" onChange={(event) => setTripImageFile(event.target.files?.[0] ?? null)} />
                  <span className="admin-upload-button">Choose Image</span>
                  <span className="admin-upload-name">{tripImageFile?.name ?? "No image selected"}</span>
                </span>
              </label>
              <label className="admin-modal-full">
                Summary
                <textarea value={tripForm.summary} onChange={(event) => setTripFormValue("summary", event.target.value)} rows={3} placeholder="A social coastal escape with safe group transport." />
              </label>
              <div className="admin-modal-full admin-pickup-points">
                <div className="admin-pickup-points-head">
                  <strong>Pickup points</strong>
                  <button type="button" onClick={addTripPickupPoint}>Add pickup point</button>
                </div>
                {tripForm.pickup_points.map((point, index) => (
                  <label key={index}>
                    Pickup point {index + 1}
                    <span className="admin-pickup-point-row">
                      <input value={point} onChange={(event) => setTripPickupPoint(index, event.target.value)} placeholder={index === 0 ? "Cape Town Station" : "UCT upper campus"} />
                      <button type="button" onClick={() => removeTripPickupPoint(index)}>Remove</button>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowTripModal(false); resetTripForm(); }}>Cancel</Button>
              <Button onClick={createTrip} disabled={saving === "trips-create" || saving === `trips-${editingTripId}`}>
                {saving === "trips-create" || saving === `trips-${editingTripId}` ? "Saving..." : editingTripId ? "Save Trip" : "Add Trip"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {!loading && !error && activeTab === "Updates" ? (
        <section className="card">
          <div className="card-head"><h3>Updates</h3><Newspaper size={20} /></div>
          <div className="admin-data-table admin-data-table-updates">
            <div className="admin-table-head admin-table-row-update">
              <span>Update</span>
              <span>Published on</span>
              <span>State</span>
              <span>Actions</span>
            </div>
            {updates.length === 0 ? <EmptyState title="No updates yet" detail="Published news and operational updates will appear here." /> : null}
            {updates.map((update) => (
              editingKey === `update-${update.id}` ? (
                <article key={update.id} className="admin-table-row admin-table-row-update">
                  <div className="admin-edit-stack">
                    <input value={String(editingValues.title ?? "")} onChange={(event) => setEditingValue("title", event.target.value)} />
                    <textarea value={String(editingValues.body ?? "")} onChange={(event) => setEditingValue("body", event.target.value)} rows={3} />
                  </div>
                  <input type="date" value={String(editingValues.published_on ?? "")} onChange={(event) => setEditingValue("published_on", event.target.value)} />
                  <label className="admin-check"><input type="checkbox" checked={Boolean(editingValues.published)} onChange={(event) => setEditingValue("published", event.target.checked)} /> Published</label>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveUpdate(update.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("updates", update.id, update.title)}>Delete</Button>
                  </div>
                </article>
              ) : (
                <article key={update.id} className="admin-table-row admin-table-row-update">
                  <div><strong>{update.title}</strong><span>{update.body}</span></div>
                  <div><strong>{formatDate(update.published_on)}</strong><span>{formatDate(update.created_at)}</span></div>
                  <StatusBadge status={update.published ? "Published" : "Draft"} />
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => startEdit(`update-${update.id}`, { title: update.title, body: update.body, published_on: update.published_on, published: update.published })}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("updates", update.id, update.title)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Reviews" ? (
        <section className="card">
          <div className="card-head">
            <h3>Reviews</h3>
            <Button onClick={() => openReviewForm()}>Add Review</Button>
          </div>
          <div className="admin-data-table admin-data-table-reviews">
            <div className="admin-table-head admin-table-row-review">
              <span>Author</span>
              <span>Review</span>
              <span>Trip</span>
              <span>State</span>
              <span>Actions</span>
            </div>
            {reviews.length === 0 ? <EmptyState title="No reviews yet" detail="Customer review submissions will appear here." /> : null}
            {reviews.map((review) => (
              editingKey === `review-${review.id}` ? (
                <article key={review.id} className="admin-table-row admin-table-row-review">
                  <input value={String(editingValues.author_name ?? "")} onChange={(event) => setEditingValue("author_name", event.target.value)} />
                  <div className="admin-edit-stack">
                    <select value={String(editingValues.rating ?? "5")} onChange={(event) => setEditingValue("rating", event.target.value)}>
                      <option value="5">5 stars</option>
                      <option value="4">4 stars</option>
                      <option value="3">3 stars</option>
                      <option value="2">2 stars</option>
                      <option value="1">1 star</option>
                    </select>
                    <textarea value={String(editingValues.quote ?? "")} onChange={(event) => setEditingValue("quote", event.target.value)} rows={3} />
                  </div>
                  <select value={String(editingValues.trip_id ?? "")} onChange={(event) => setEditingValue("trip_id", event.target.value)}>
                    <option value="">General review</option>
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>{trip.title}</option>
                    ))}
                  </select>
                  <label className="admin-check"><input type="checkbox" checked={Boolean(editingValues.published)} onChange={(event) => setEditingValue("published", event.target.checked)} /> Published</label>
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => saveReview(review.id)}>Save</Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("reviews", review.id, review.author_name)}>Delete</Button>
                  </div>
                </article>
              ) : (
                <article key={review.id} className="admin-table-row admin-table-row-review">
                  <div><strong>{review.author_name}</strong><span>{review.rating}/5 stars</span></div>
                  <span>{review.quote}</span>
                  <strong>{review.trips?.title ?? "General review"}</strong>
                  <StatusBadge status={review.published ? "Published" : "Pending"} />
                  <div className="admin-actions">
                    <Button variant="secondary" onClick={() => openReviewForm(review)}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("reviews", review.id, review.author_name)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {showReviewModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-review-title">
            <div className="card-head">
              <div>
                <h3 id="add-review-title">{editingReviewId ? "Edit Review" : "Add Review"}</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label>
                Author name
                <input value={reviewForm.author_name} onChange={(event) => setReviewFormValue("author_name", event.target.value)} placeholder="Lerato Mokone" />
              </label>
              <label>
                Rating
                <select value={reviewForm.rating} onChange={(event) => setReviewFormValue("rating", event.target.value)}>
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </label>
              <label className="admin-modal-full">
                Trip
                <select value={reviewForm.trip_id} onChange={(event) => setReviewFormValue("trip_id", event.target.value)}>
                  <option value="">General review</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>{trip.title}</option>
                  ))}
                </select>
              </label>
              <label className="admin-modal-full">
                Review
                <textarea value={reviewForm.quote} onChange={(event) => setReviewFormValue("quote", event.target.value)} rows={4} placeholder="Booking was simple from start, updates were clear..." />
              </label>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowReviewModal(false); resetReviewForm(); }}>Cancel</Button>
              <Button onClick={createReview} disabled={saving === "reviews-create" || saving === `reviews-${editingReviewId}`}>
                {saving === "reviews-create" || saving === `reviews-${editingReviewId}` ? "Saving..." : editingReviewId ? "Save Review" : "Add Review"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="admin-feedback-popover" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
          <section>
            <strong id="admin-delete-title" className="warning">Confirm delete</strong>
            <p>Delete {pendingDelete.label}? This action cannot be undone.</p>
            <div className="admin-feedback-actions">
              <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={Boolean(saving)}>Cancel</Button>
              <Button variant="ghost" onClick={confirmDeleteRecord} disabled={Boolean(saving)}>{saving ? "Deleting..." : "Delete"}</Button>
            </div>
          </section>
        </div>
      ) : null}

      {error ? (
        <div className="admin-feedback-popover" role="dialog" aria-modal="true" aria-labelledby="admin-error-title">
          <section>
            <strong id="admin-error-title" className="warning">Something needs attention</strong>
            <p>{error}</p>
            <Button onClick={() => setError("")}>OK</Button>
          </section>
        </div>
      ) : null}

      {successMessage ? (
        <div className="admin-feedback-popover" role="dialog" aria-modal="true" aria-labelledby="admin-success-title">
          <section>
            <strong id="admin-success-title">Success</strong>
            <p>{successMessage}</p>
            <Button onClick={() => setSuccessMessage("")}>OK</Button>
          </section>
        </div>
      ) : null}

      {saving ? <p className="admin-saving">Saving changes...</p> : null}
    </RoleShell>
  );
}
