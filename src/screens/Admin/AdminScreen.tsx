import { BarChart3, Building2, CreditCard, FileCheck2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatDate, formatMoney } from "../../lib/data";
import { deriveTripStatus } from "../../lib/db";
import { friendlyError } from "../../lib/friendlyError";
import { logActivity } from "../../lib/activityLog";
import { supabase } from "../../lib/supabase";
import { Button } from "../../shared/components/Button";
import { StatCard } from "../../shared/components/StatCard";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import { RoleShell } from "../../shared/layout/RoleShell";
import "./AdminScreen.css";

const adminTabs = ["Overview", "Branch Manager", "Bookings", "Users", "Cities", "Trips", "Payments", "Inquiries", "Updates", "Reviews", "Logs"];
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
  branch_city_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  campus: string | null;
  organisation: string | null;
  profile_complete_percent: number | null;
  created_at: string;
  cities?: { name: string | null } | null;
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

type AdminPickupPoint = {
  id: string;
  city_id: string;
  area: string;
  point: string;
  sort_order: number;
  active: boolean;
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
  community_price_cents: number | null;
  non_community_price_cents: number | null;
  original_price_cents: number | null;
  deposit_cents: number;
  capacity: number;
  seats_remaining: number;
  status: string;
  is_special: boolean;
  special_collection_slug: string | null;
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

type AdminUpdate = {
  id: string;
  title: string;
  body: string;
  banner_special_collection_slug: string | null;
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

type AdminActivityLog = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
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

function renderTripPriceSummary(trip: AdminTrip) {
  const communityPrice = trip.community_price_cents ?? trip.price_cents;
  const nonCommunityPrice = trip.non_community_price_cents ?? trip.original_price_cents ?? trip.price_cents;
  const comparePrice = trip.original_price_cents;

  return (
    <div className="admin-trip-price-stack">
      <strong>{`Community ${formatMoney(communityPrice)}`}</strong>
      <span>{`Non-community ${formatMoney(nonCommunityPrice)}`}</span>
      {comparePrice && comparePrice > nonCommunityPrice ? <span>{`Compare-at ${formatMoney(comparePrice)}`}</span> : null}
    </div>
  );
}

function includesText(value: string | null | undefined, query: string) {
  if (!query.trim()) return true;
  return (value ?? "").toLowerCase().includes(query.trim().toLowerCase());
}

export function AdminScreen() {
  const [activeTab, setActiveTabState] = useState(getSavedAdminTab);
  const [currentProfile, setCurrentProfile] = useState<AdminProfile | null>(null);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [cities, setCities] = useState<(AdminCity & { tripCount: number })[]>([]);
  const [cityPickupPoints, setCityPickupPoints] = useState<AdminPickupPoint[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [proofs, setProofs] = useState<AdminProof[]>([]);
  const [partnerInquiries, setPartnerInquiries] = useState<PartnerInquiry[]>([]);
  const [updates, setUpdates] = useState<AdminUpdate[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [editingValues, setEditingValues] = useState<Record<string, string | boolean>>({});
  const [showCityModal, setShowCityModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showBranchManagerModal, setShowBranchManagerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingCityId, setEditingCityId] = useState("");
  const [editingTripId, setEditingTripId] = useState("");
  const [editingProfileId, setEditingProfileId] = useState("");
  const [editingBranchManagerId, setEditingBranchManagerId] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState("");
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
    community_price: "",
    non_community_price: "",
    compare_price: "",
    deposit: "",
    capacity: "",
    seats_remaining: "",
    is_special: false,
    special_collection_slug: "",
  });
  const [tripImageFile, setTripImageFile] = useState<File | null>(null);
  const [reviewForm, setReviewForm] = useState({
    author_name: "",
    rating: "5",
    quote: "",
    trip_id: "",
  });
  const [updateForm, setUpdateForm] = useState({
    title: "",
    body: "",
    banner_special_collection_slug: "",
    published_on: new Date().toISOString().slice(0, 10),
    published: true,
  });
  const [branchManagerForm, setBranchManagerForm] = useState({
    email: "",
    branch_city_id: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    campus: "",
    organisation: "",
    role: "customer",
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tableFilters, setTableFilters] = useState({
    branchManagersQuery: "",
    tripsQuery: "",
    tripsCity: "",
    bookingsQuery: "",
    bookingsStatus: "",
    usersQuery: "",
    usersRole: "",
    paymentsQuery: "",
    paymentsStatus: "",
    inquiriesQuery: "",
    inquiriesCity: "",
    citiesQuery: "",
    reviewsQuery: "",
    reviewsState: "",
    updatesQuery: "",
    logsQuery: "",
  });

  function setActiveTab(nextTab: string) {
    setActiveTabState(nextTab);
    try {
      window.localStorage.setItem(adminTabStorageKey, nextTab);
    } catch {
      // Keep tab navigation working when storage is unavailable.
    }
  }

  function setTableFilter(field: keyof typeof tableFilters, value: string) {
    setTableFilters((current) => ({ ...current, [field]: value }));
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
      updateResult,
      reviewResult,
      activityLogResult,
      pickupPointResult,
    ] = await Promise.all([
      userId ? supabase.from("profiles").select("id,role,branch_city_id,first_name,last_name,email,phone,campus,organisation,profile_complete_percent,created_at,cities(name)").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from("profiles").select("id,role,branch_city_id,first_name,last_name,email,phone,campus,organisation,profile_complete_percent,created_at,cities(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("cities").select("id,slug,name,province,active,support_email,support_phone,image_url,tagline,trips(count)").order("name"),
      supabase.from("trips").select("id,slug,title,category,image_url,summary,meeting_point,pickup_points,start_date,duration,price_cents,community_price_cents,non_community_price_cents,original_price_cents,deposit_cents,capacity,seats_remaining,status,is_special,special_collection_slug,published,created_at,cities(id,name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("bookings").select("id,user_id,booking_ref,status,total_cents,paid_cents,outstanding_cents,created_at,trips(title,cities(name))").order("created_at", { ascending: false }).limit(100),
      supabase.from("payments").select("id,amount_cents,method,status,provider,provider_reference,paid_at,created_at,bookings(booking_ref,status,trips(title))").order("created_at", { ascending: false }).limit(100),
      supabase.from("payment_proofs").select("id,booking_id,file_path,file_name,amount_cents,approved,created_at,bookings(booking_ref)").order("created_at", { ascending: false }).limit(100),
      supabase.from("partner_inquiries").select("id,inquiry_type,name,email,phone,organisation,campus,preferred_city,details,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("updates").select("id,title,body,banner_special_collection_slug,published_on,published,created_at").order("published_on", { ascending: false }).limit(100),
      supabase.from("reviews").select("id,trip_id,author_name,rating,quote,published,created_at,trips(title)").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("activity_logs")
        .select("id,actor_id,actor_role,action,entity_type,entity_id,entity_label,details,created_at,profiles(first_name,last_name,email)")
        .order("created_at", { ascending: false })
        .limit(150),
      supabase.from("city_pickup_points").select("id,city_id,area,point,sort_order,active").eq("active", true).order("city_id").order("sort_order").order("area").order("point"),
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
      updateResult.error ??
      reviewResult.error ??
      pickupPointResult.error;

    if (firstError) {
      setError(friendlyError(firstError, "We could not load admin data right now. Please try again."));
    }

    setCurrentProfile((currentProfileResult.data as AdminProfile | null) ?? null);
    setProfiles((profilesResult.data as AdminProfile[] | null) ?? []);
    setCities(((cityResult.data as unknown as AdminCity[] | null) ?? []).map((city) => ({ ...city, tripCount: city.trips?.[0]?.count ?? 0 })));
    setCityPickupPoints((pickupPointResult.data as AdminPickupPoint[] | null) ?? []);
    setTrips((tripResult.data as unknown as AdminTrip[] | null) ?? []);
    setBookings((bookingResult.data as unknown as AdminBooking[] | null) ?? []);
    setPayments((paymentResult.data as unknown as AdminPayment[] | null) ?? []);
    setProofs((proofResult.data as unknown as AdminProof[] | null) ?? []);
    setPartnerInquiries((partnerResult.data as PartnerInquiry[] | null) ?? []);
    setUpdates((updateResult.data as AdminUpdate[] | null) ?? []);
    setReviews((reviewResult.data as unknown as AdminReview[] | null) ?? []);
    setActivityLogs((activityLogResult.data as unknown as AdminActivityLog[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAdmin();
  }, []);

  async function updateRecord(
    table: string,
    id: string,
    values: Record<string, unknown>,
    activity?: {
      action: string;
      entityType: string;
      entityLabel?: string | null;
      details?: Record<string, unknown>;
    },
  ) {
    if (!supabase) return;
    setSaving(`${table}-${id}`);
    const { error: updateError } = await supabase.from(table).update(values).eq("id", id);
    if (updateError) {
      setError(friendlyError(updateError, "Could not save changes. Please try again."));
    } else {
      if (activity) {
        await logActivity({
          action: activity.action,
          entityType: activity.entityType,
          entityId: id,
          entityLabel: activity.entityLabel ?? id,
          details: activity.details ?? values,
        });
      }
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
      setError(friendlyError(deleteError, "Could not delete this record. Please try again."));
    } else {
      await logActivity({
        action: `${pendingDelete.table}_deleted`,
        entityType: pendingDelete.table,
        entityId: pendingDelete.id,
        entityLabel: pendingDelete.label,
        details: { label: pendingDelete.label },
      });
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
      setError(friendlyError(updateError, "Could not update this role. Please try again."));
    } else {
      await logActivity({
        action: "profile_role_updated",
        entityType: "profile",
        entityId: id,
        entityLabel: profilesById[id] ? personName(profilesById[id]) : id,
        details: { role },
      });
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
    setTripForm((current) => {
      if (field === "title" && typeof value === "string" && (!current.slug || current.slug === slugify(current.title))) {
        return { ...current, title: value, slug: slugify(value) };
      }

      return { ...current, [field]: value };
    });
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
      community_price: "",
      non_community_price: "",
      compare_price: "",
      deposit: "",
      capacity: "",
      seats_remaining: "",
      is_special: false,
      special_collection_slug: "",
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

  function setUpdateFormValue(field: keyof typeof updateForm, value: string | boolean) {
    setUpdateForm((current) => ({ ...current, [field]: value }));
  }

  function resetUpdateForm() {
    setEditingUpdateId("");
    setUpdateForm({
      title: "",
      body: "",
      banner_special_collection_slug: "",
      published_on: new Date().toISOString().slice(0, 10),
      published: true,
    });
  }

  function setBranchManagerFormValue(field: keyof typeof branchManagerForm, value: string) {
    setBranchManagerForm((current) => ({ ...current, [field]: value }));
  }

  function resetBranchManagerForm() {
    setEditingBranchManagerId("");
    setBranchManagerForm({
      email: "",
      branch_city_id: "",
      first_name: "",
      last_name: "",
      phone: "",
    });
  }

  function openBranchManagerForm(manager?: AdminProfile) {
    if (manager) {
      setEditingBranchManagerId(manager.id);
      setBranchManagerForm({
        email: manager.email ?? "",
        branch_city_id: manager.branch_city_id ?? "",
        first_name: manager.first_name ?? "",
        last_name: manager.last_name ?? "",
        phone: manager.phone ?? "",
      });
    } else {
      resetBranchManagerForm();
    }

    setShowBranchManagerModal(true);
  }

  function setProfileFormValue(field: keyof typeof profileForm, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function resetProfileForm() {
    setEditingProfileId("");
    setProfileForm({
      first_name: "",
      last_name: "",
      phone: "",
      campus: "",
      organisation: "",
      role: "customer",
    });
  }

  function openProfileForm(profile: AdminProfile) {
    setEditingProfileId(profile.id);
    setProfileForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone: profile.phone ?? "",
      campus: profile.campus ?? "",
      organisation: profile.organisation ?? "",
      role: profile.role,
    });
    setShowProfileModal(true);
  }

  function openUpdateForm(update?: AdminUpdate) {
    if (update) {
      setEditingUpdateId(update.id);
      setUpdateForm({
        title: update.title,
        body: update.body,
        banner_special_collection_slug: update.banner_special_collection_slug ?? "",
        published_on: update.published_on,
        published: update.published,
      });
    } else {
      resetUpdateForm();
    }
    setShowUpdateModal(true);
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
        community_price: String((trip.community_price_cents ?? trip.price_cents) / 100),
        non_community_price: String((trip.non_community_price_cents ?? trip.original_price_cents ?? trip.price_cents) / 100),
        compare_price: trip.original_price_cents ? String(trip.original_price_cents / 100) : "",
        deposit: String(trip.deposit_cents / 100),
        capacity: String(trip.capacity),
        seats_remaining: String(trip.seats_remaining),
        is_special: Boolean(trip.is_special),
        special_collection_slug: trip.special_collection_slug ?? "",
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

  function toggleTripPickupPoint(point: string) {
    setTripForm((current) => {
      const exists = current.pickup_points.includes(point);
      const nextPickupPoints = exists ? current.pickup_points.filter((item) => item !== point) : [...current.pickup_points.filter(Boolean), point];
      const sanitizedPickupPoints = nextPickupPoints.length > 0 ? nextPickupPoints : [""];
      const nextMeetingPoint =
        current.meeting_point && sanitizedPickupPoints.includes(current.meeting_point)
          ? current.meeting_point
          : sanitizedPickupPoints.find(Boolean) ?? "";

      return {
        ...current,
        pickup_points: sanitizedPickupPoints,
        meeting_point: nextMeetingPoint,
      };
    });
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
      setError(friendlyError(uploadError, "Could not upload this image. Please try again."));
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
      setError(friendlyError(insertError, "Could not save this city. Please check the details and try again."));
    } else {
      await logActivity({
        action: wasEditing ? "city_updated" : "city_created",
        entityType: "city",
        entityId: editingCityId || null,
        entityLabel: name,
        details: cityValues,
      });
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
    const communityPriceCents = Math.round(Number(tripForm.community_price) * 100);
    const nonCommunityPriceCents = Math.round(Number(tripForm.non_community_price) * 100);
    const comparePriceCents = tripForm.compare_price ? Math.round(Number(tripForm.compare_price) * 100) : null;
    const depositCents = Math.round(Number(tripForm.deposit || "0") * 100);
    const capacity = Number.parseInt(tripForm.capacity, 10);
    const seatsRemaining = Number.parseInt(tripForm.seats_remaining || tripForm.capacity, 10);
    const pickupPoints = tripForm.pickup_points.map((point) => point.trim()).filter(Boolean);
    const specialCollectionSlug = tripForm.is_special ? (tripForm.special_collection_slug.trim() || slugify(title)) : null;

    if (!title || !slug || !tripForm.category.trim() || !tripForm.start_date || (!editingTripId && !tripForm.city_id)) {
      setError("Trip title, slug, city, category, and start date are required.");
      return;
    }

    if (!Number.isFinite(communityPriceCents) || communityPriceCents < 0 || !Number.isFinite(nonCommunityPriceCents) || nonCommunityPriceCents < 0 || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(seatsRemaining) || seatsRemaining < 0) {
      setError("Community price, non-community price, capacity, and seats must be valid numbers.");
      return;
    }

    if (nonCommunityPriceCents < communityPriceCents) {
      setError("Non-community price must be greater than or equal to community price.");
      return;
    }

    if (comparePriceCents !== null && (!Number.isFinite(comparePriceCents) || comparePriceCents < Math.max(communityPriceCents, nonCommunityPriceCents))) {
      setError("Compare-at price must be greater than or equal to both live prices.");
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
      price_cents: communityPriceCents,
      community_price_cents: communityPriceCents,
      non_community_price_cents: nonCommunityPriceCents,
      original_price_cents: comparePriceCents,
      deposit_cents: depositCents,
      capacity,
      seats_remaining: Math.min(seatsRemaining, capacity),
      is_special: tripForm.is_special,
      special_collection_slug: specialCollectionSlug,
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
          setError(friendlyError(legacyError, "Could not save this trip. Please check the details and try again."));
        } else {
          await logActivity({
            action: wasEditing ? "trip_updated" : "trip_created",
            entityType: "trip",
            entityId: editingTripId || null,
            entityLabel: title,
            details: legacyTripValues,
          });
          setShowTripModal(false);
          resetTripForm();
          await loadAdmin();
          setSuccessMessage(wasEditing ? "Trip updated successfully." : "Trip added successfully.");
        }
      } else {
        setError(friendlyError(insertError, "Could not save this trip. Please check the details and try again."));
      }
    } else {
      await logActivity({
        action: wasEditing ? "trip_updated" : "trip_created",
        entityType: "trip",
        entityId: editingTripId || null,
        entityLabel: title,
        details: tripValues,
      });
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
      setError(friendlyError(insertError, "Could not save this review. Please check the details and try again."));
    } else {
      await logActivity({
        action: wasEditing ? "review_updated" : "review_created",
        entityType: "review",
        entityId: editingReviewId || null,
        entityLabel: authorName,
        details: reviewValues,
      });
      setShowReviewModal(false);
      resetReviewForm();
      await loadAdmin();
      setSuccessMessage(wasEditing ? "Review updated successfully." : "Review added successfully.");
    }
    setSaving("");
  }

  async function createUpdate() {
    if (!supabase) return;

    const wasEditing = Boolean(editingUpdateId);
    const title = updateForm.title.trim();
    const body = updateForm.body.trim();

    if (!title || !body || !updateForm.published_on) {
      setError("Update title, body, and publish date are required.");
      return;
    }

    setSaving(editingUpdateId ? `updates-${editingUpdateId}` : "updates-create");
    const updateValues = {
      title,
      body,
      banner_special_collection_slug: updateForm.banner_special_collection_slug.trim() || null,
      published_on: updateForm.published_on,
      published: updateForm.published,
    };

    const { error: insertError } = editingUpdateId
      ? await supabase.from("updates").update(updateValues).eq("id", editingUpdateId)
      : await supabase.from("updates").insert(updateValues);

    if (insertError) {
      setError(friendlyError(insertError, "Could not save this update. Please check the details and try again."));
    } else {
      await logActivity({
        action: wasEditing ? "update_updated" : "update_created",
        entityType: "update",
        entityId: editingUpdateId || null,
        entityLabel: title,
        details: updateValues,
      });
      setShowUpdateModal(false);
      resetUpdateForm();
      await loadAdmin();
      setSuccessMessage(wasEditing ? "Update saved successfully." : "Update added successfully.");
    }
    setSaving("");
  }

  async function createBranchManager() {
    if (!supabase) return;

    const email = branchManagerForm.email.trim().toLowerCase();
    const isEditing = Boolean(editingBranchManagerId);

    if (!email) {
      setError("Branch manager email is required.");
      return;
    }

    if (!branchManagerForm.branch_city_id) {
      setError("Please choose the city branch this manager belongs to.");
      return;
    }

    setSaving(isEditing ? `branch-manager-${editingBranchManagerId}` : "branch-manager-create");
    const assignmentValues = {
      email,
      branch_city_id: branchManagerForm.branch_city_id,
      first_name: branchManagerForm.first_name.trim() || null,
      last_name: branchManagerForm.last_name.trim() || null,
      phone: branchManagerForm.phone.trim() || null,
    };

    const { error: assignmentError } = await supabase
      .from("branch_manager_assignments")
      .upsert(assignmentValues, { onConflict: "email" });

    if (assignmentError) {
      setError(friendlyError(assignmentError, "Could not save this branch manager assignment. Please try again."));
      setSaving("");
      return;
    }

    const profileQuery = supabase.from("profiles").select("id,email");
    const { data: profile, error: profileError } = isEditing
      ? await profileQuery.eq("id", editingBranchManagerId).maybeSingle()
      : await profileQuery.ilike("email", email).maybeSingle();

    if (profileError) {
      setError(friendlyError(profileError, "Could not find or create this branch manager profile. Please try again."));
      setSaving("");
      return;
    }

    if (!profile) {
      await logActivity({
        action: isEditing ? "branch_manager_assignment_updated" : "branch_manager_assignment_created",
        entityType: "branch_manager_assignment",
        entityLabel: email,
        details: assignmentValues,
      });
      setShowBranchManagerModal(false);
      resetBranchManagerForm();
      setSuccessMessage("Branch manager assignment saved. When this email signs up, their role will become branch automatically.");
      setSaving("");
      return;
    }

    const values: Record<string, string> = { role: "branch", branch_city_id: branchManagerForm.branch_city_id };
    (["first_name", "last_name", "phone"] as const).forEach((field) => {
      const value = branchManagerForm[field].trim();
      if (value) values[field] = value;
    });

    const { error: updateError } = await supabase.from("profiles").update(values).eq("id", profile.id);

    if (updateError) {
      setError(friendlyError(updateError, "Could not update this branch manager. Please try again."));
    } else {
      await logActivity({
        action: isEditing ? "branch_manager_updated" : "branch_manager_created",
        entityType: "profile",
        entityId: profile.id,
        entityLabel: email,
        details: values,
      });
      setShowBranchManagerModal(false);
      resetBranchManagerForm();
      await loadAdmin();
      setSuccessMessage(isEditing ? "Branch manager updated successfully." : "Branch manager added successfully.");
    }
    setSaving("");
  }

  async function saveTrip(id: string) {
    await updateRecord("trips", id, {
      title: String(editingValues.title ?? "").trim(),
      category: String(editingValues.category ?? "").trim(),
      start_date: String(editingValues.start_date ?? ""),
      published: Boolean(editingValues.published),
    }, {
      action: "trip_quick_updated",
      entityType: "trip",
      entityLabel: String(editingValues.title ?? id).trim() || id,
    });
    cancelEdit();
  }

  async function saveBooking(id: string) {
    await updateRecord("bookings", id, {
      status: String(editingValues.status ?? "Pending Payment"),
    }, {
      action: "booking_updated",
      entityType: "booking",
      entityLabel: String(editingValues.booking_ref ?? id).trim() || id,
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
        await logActivity({
          action: "payment_proof_rejected",
          entityType: "payment_proof",
          entityId: proof.id,
          entityLabel: proof.bookings?.booking_ref ?? proof.file_name ?? proof.id,
          details: {
            booking_id: proof.booking_id,
            booking_ref: proof.bookings?.booking_ref ?? null,
            approved,
            amount_cents: proof.amount_cents,
          },
        });
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
      setError(friendlyError(bookingLoadError, "Could not load booking for this proof."));
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
      await logActivity({
        action: "payment_proof_approved",
        entityType: "payment_proof",
        entityId: proof.id,
        entityLabel: proof.bookings?.booking_ref ?? proof.file_name ?? proof.id,
        details: {
          booking_id: proof.booking_id,
          booking_ref: proof.bookings?.booking_ref ?? null,
          approved,
          amount_cents: proof.amount_cents,
          next_paid_cents: nextPaid,
          booking_status: nextStatus,
        },
      });
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
      setError(friendlyError(signedUrlError, "Could not open payment proof."));
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    setSaving("");
  }

  async function saveProfileForm() {
    if (!editingProfileId) return;

    await updateRecord("profiles", editingProfileId, {
      first_name: profileForm.first_name.trim() || null,
      last_name: profileForm.last_name.trim() || null,
      phone: profileForm.phone.trim() || null,
      campus: profileForm.campus.trim() || null,
      organisation: profileForm.organisation.trim() || null,
      role: profileForm.role,
    }, {
      action: "profile_updated",
      entityType: "profile",
      entityLabel: `${profileForm.first_name} ${profileForm.last_name}`.trim() || editingProfileId,
    });

    setShowProfileModal(false);
    resetProfileForm();
  }

  async function saveCity(id: string) {
    await updateRecord("cities", id, {
      name: String(editingValues.name ?? "").trim(),
      province: String(editingValues.province ?? "").trim() || null,
      support_email: String(editingValues.support_email ?? "").trim() || null,
      support_phone: String(editingValues.support_phone ?? "").trim() || null,
      active: Boolean(editingValues.active),
    }, {
      action: "city_quick_updated",
      entityType: "city",
      entityLabel: String(editingValues.name ?? id).trim() || id,
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
    }, {
      action: "review_updated",
      entityType: "review",
      entityLabel: String(editingValues.author_name ?? id).trim() || id,
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
  const branchManagers = useMemo(() => profiles.filter((profile) => profile.role === "branch"), [profiles]);
  const maxCityTripCount = useMemo(() => Math.max(...cities.map((city) => city.tripCount), 1), [cities]);
  const selectedCityPickupPoints = useMemo(
    () => cityPickupPoints.filter((item) => item.city_id === tripForm.city_id),
    [cityPickupPoints, tripForm.city_id],
  );
  const groupedSelectedCityPickupPoints = useMemo(
    () =>
      selectedCityPickupPoints.reduce<Record<string, AdminPickupPoint[]>>((groups, item) => {
        groups[item.area] = [...(groups[item.area] ?? []), item];
        return groups;
      }, {}),
    [selectedCityPickupPoints],
  );
  const activePayments = useMemo(
    () => payments.filter((payment) => !payment.bookings?.status || activeBookingStatuses.has(payment.bookings.status)),
    [payments],
  );
  const filteredBranchManagers = useMemo(
    () =>
      branchManagers.filter(
        (manager) =>
          includesText(`${personName(manager)} ${manager.email ?? ""} ${manager.phone ?? ""} ${manager.cities?.name ?? ""}`, tableFilters.branchManagersQuery),
      ),
    [branchManagers, tableFilters.branchManagersQuery],
  );
  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const matchesQuery = includesText(`${trip.title} ${trip.category} ${trip.slug} ${trip.cities?.name ?? ""}`, tableFilters.tripsQuery);
        const matchesCity = !tableFilters.tripsCity || (trip.cities?.name ?? "") === tableFilters.tripsCity;
        return matchesQuery && matchesCity;
      }),
    [tableFilters.tripsCity, tableFilters.tripsQuery, trips],
  );
  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const matchesQuery = includesText(`${booking.booking_ref} ${booking.trips?.title ?? ""} ${profilesById[booking.user_id]?.email ?? ""} ${personName(profilesById[booking.user_id] ?? null)}`, tableFilters.bookingsQuery);
        const matchesStatus = !tableFilters.bookingsStatus || booking.status === tableFilters.bookingsStatus;
        return matchesQuery && matchesStatus;
      }),
    [bookings, profilesById, tableFilters.bookingsQuery, tableFilters.bookingsStatus],
  );
  const filteredProfiles = useMemo(
    () =>
      profiles.filter((profile) => {
        const matchesQuery = includesText(`${personName(profile)} ${profile.email ?? ""} ${profile.phone ?? ""} ${profile.campus ?? ""} ${profile.organisation ?? ""}`, tableFilters.usersQuery);
        const matchesRole = !tableFilters.usersRole || profile.role === tableFilters.usersRole;
        return matchesQuery && matchesRole;
      }),
    [profiles, tableFilters.usersQuery, tableFilters.usersRole],
  );
  const filteredActivePayments = useMemo(
    () =>
      activePayments.filter((payment) => {
        const matchesQuery = includesText(`${payment.bookings?.booking_ref ?? ""} ${payment.bookings?.trips?.title ?? ""} ${payment.provider_reference ?? ""} ${payment.provider ?? ""} ${payment.method}`, tableFilters.paymentsQuery);
        const matchesStatus = !tableFilters.paymentsStatus || payment.status === tableFilters.paymentsStatus;
        return matchesQuery && matchesStatus;
      }),
    [activePayments, tableFilters.paymentsQuery, tableFilters.paymentsStatus],
  );
  const filteredProofs = useMemo(
    () =>
      proofs.filter((proof) =>
        includesText(`${proof.bookings?.booking_ref ?? ""} ${proof.file_name ?? ""}`, tableFilters.paymentsQuery),
      ),
    [proofs, tableFilters.paymentsQuery],
  );
  const filteredPartnerInquiries = useMemo(
    () =>
      partnerInquiries.filter((inquiry) => {
        const matchesQuery = includesText(`${inquiry.name} ${inquiry.email} ${inquiry.organisation ?? ""} ${inquiry.campus ?? ""} ${inquiry.details ?? ""}`, tableFilters.inquiriesQuery);
        const matchesCity = !tableFilters.inquiriesCity || (inquiry.preferred_city ?? "") === tableFilters.inquiriesCity;
        return matchesQuery && matchesCity;
      }),
    [partnerInquiries, tableFilters.inquiriesCity, tableFilters.inquiriesQuery],
  );
  const filteredCities = useMemo(
    () => cities.filter((city) => includesText(`${city.name} ${city.slug} ${city.province ?? ""} ${city.support_email ?? ""}`, tableFilters.citiesQuery)),
    [cities, tableFilters.citiesQuery],
  );
  const filteredReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const matchesQuery = includesText(`${review.author_name} ${review.quote} ${review.trips?.title ?? ""}`, tableFilters.reviewsQuery);
        const matchesState = !tableFilters.reviewsState || (tableFilters.reviewsState === "Published" ? review.published : !review.published);
        return matchesQuery && matchesState;
      }),
    [reviews, tableFilters.reviewsQuery, tableFilters.reviewsState],
  );
  const filteredUpdates = useMemo(
    () => updates.filter((update) => includesText(`${update.title} ${update.body} ${update.banner_special_collection_slug ?? ""}`, tableFilters.updatesQuery)),
    [tableFilters.updatesQuery, updates],
  );
  const filteredActivityLogs = useMemo(
    () =>
      activityLogs.filter((log) =>
        includesText(`${log.action} ${log.entity_type} ${log.entity_label ?? ""} ${log.profiles?.email ?? ""} ${log.profiles?.first_name ?? ""} ${log.profiles?.last_name ?? ""}`, tableFilters.logsQuery),
      ),
    [activityLogs, tableFilters.logsQuery],
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
      {loading ? <section className="card app-empty-state"><ThemeLoader label="Loading admin dashboard" /><p>Loading admin dashboard...</p></section> : null}
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

      {!loading && !error && activeTab === "Branch Manager" ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Branch managers</h3>
              <p>Manage staff members who can operate branch workspaces.</p>
            </div>
            <Button onClick={() => openBranchManagerForm()}>Add Branch Manager</Button>
          </div>
          <div className="admin-filter-bar">
            <input value={tableFilters.branchManagersQuery} onChange={(event) => setTableFilter("branchManagersQuery", event.target.value)} placeholder="Search branch managers" />
          </div>
          <div className="admin-data-table admin-data-table-branch-managers">
            <div className="admin-table-head admin-table-row-branch-manager">
              <span>Name</span>
              <span>Contact</span>
              <span>Branch</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredBranchManagers.length === 0 ? <EmptyState title="No branch managers found" detail="Try another search or add a branch manager." /> : null}
            {filteredBranchManagers.map((manager) => (
              <article key={manager.id} className="admin-table-row admin-table-row-branch-manager">
                <div><strong>{personName(manager)}</strong><span>{manager.profile_complete_percent ?? 0}% complete</span></div>
                <div><strong>{manager.email ?? "No email"}</strong><span>{manager.phone ?? "No phone"}</span></div>
                <div><strong>{manager.cities?.name ?? "No branch city"}</strong><span>{manager.organisation ?? manager.campus ?? "No organisation"}</span></div>
                <StatusBadge status="branch" />
                <div className="admin-actions">
                  <Button variant="secondary" onClick={() => openBranchManagerForm(manager)}>Edit</Button>
                  <Button variant="ghost" onClick={() => updateProfileRole(manager.id, "customer")}>Remove</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Trips" ? (
        <section className="card">
          <div className="card-head">
            <h3>Trips</h3>
            <Button onClick={() => openTripForm()}>Add Trip</Button>
          </div>
          <div className="admin-filter-bar">
            <input value={tableFilters.tripsQuery} onChange={(event) => setTableFilter("tripsQuery", event.target.value)} placeholder="Search trips" />
            <select value={tableFilters.tripsCity} onChange={(event) => setTableFilter("tripsCity", event.target.value)}>
              <option value="">All cities</option>
              {cities.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
            </select>
          </div>
          <div className="admin-data-table admin-data-table-trips">
            <div className="admin-table-head admin-table-row-trip">
              <span>Trip</span>
              <span>Schedule</span>
              <span>Price</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredTrips.length === 0 ? <EmptyState title="No trips found" detail="Try another search or city filter." /> : null}
            {filteredTrips.map((trip) => (
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
                  {renderTripPriceSummary(trip)}
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
                  <div><strong>{trip.title}</strong><span>{trip.cities?.name ?? "No city"} - {trip.category}{trip.is_special ? ` - ${trip.special_collection_slug ?? "special"}` : ""}</span></div>
                  <div><strong>{formatDate(trip.start_date)}</strong><span>{trip.seats_remaining}/{trip.capacity} seats</span></div>
                  {renderTripPriceSummary(trip)}
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
          <div className="admin-filter-bar">
            <input value={tableFilters.bookingsQuery} onChange={(event) => setTableFilter("bookingsQuery", event.target.value)} placeholder="Search bookings" />
            <select value={tableFilters.bookingsStatus} onChange={(event) => setTableFilter("bookingsStatus", event.target.value)}>
              <option value="">All statuses</option>
              {Array.from(new Set(bookings.map((booking) => booking.status))).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="admin-data-table admin-data-table-bookings">
            <div className="admin-table-head admin-table-row-booking">
              <span>Booking</span>
              <span>User</span>
              <span>Payment</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredBookings.length === 0 ? <EmptyState title="No bookings found" detail="Try another search or booking status." /> : null}
            {filteredBookings.map((booking) => (
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

      {!loading && !error && activeTab === "Users" ? (
        <section className="card">
          <div className="card-head"><h3>Users and staff</h3><Users size={20} /></div>
          <div className="admin-filter-bar">
            <input value={tableFilters.usersQuery} onChange={(event) => setTableFilter("usersQuery", event.target.value)} placeholder="Search users" />
            <select value={tableFilters.usersRole} onChange={(event) => setTableFilter("usersRole", event.target.value)}>
              <option value="">All roles</option>
              <option value="customer">customer</option>
              <option value="branch">branch</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="admin-data-table admin-data-table-customers">
            <div className="admin-table-head admin-table-row-customer">
              <span>Name</span>
              <span>Contact</span>
              <span>University</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            {filteredProfiles.length === 0 ? <EmptyState title="No users found" detail="Try another search or role filter." /> : null}
            {filteredProfiles.map((profile) => (
              <article key={profile.id} className="admin-table-row admin-table-row-customer">
                <div><strong>{personName(profile)}</strong><span>{profile.profile_complete_percent ?? 0}% complete</span></div>
                <div><strong>{profile.email ?? "No email"}</strong><span>{profile.phone ?? "No phone"}</span></div>
                <div><strong>{profile.campus ?? "No university"}</strong><span>{profile.organisation ?? "No organisation"}</span></div>
                <StatusBadge status={profile.role} />
                <div className="admin-actions">
                  <Button variant="secondary" onClick={() => openProfileForm(profile)}>Edit</Button>
                  {profile.id !== currentProfile?.id ? <Button variant="ghost" onClick={() => deleteRecord("profiles", profile.id, personName(profile))}>Delete</Button> : null}
                </div>
              </article>
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
            <div className="admin-filter-bar">
              <input value={tableFilters.paymentsQuery} onChange={(event) => setTableFilter("paymentsQuery", event.target.value)} placeholder="Search payments or proofs" />
              <select value={tableFilters.paymentsStatus} onChange={(event) => setTableFilter("paymentsStatus", event.target.value)}>
                <option value="">All payment statuses</option>
                {Array.from(new Set(payments.map((payment) => payment.status))).map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="admin-payment-list">
              {filteredActivePayments.length === 0 ? <EmptyState title="No payments found" detail="Try another search or payment status." /> : null}
              {filteredActivePayments.map((payment) => (
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
                    <Button variant="secondary" onClick={() => updateRecord("payments", payment.id, { status: "Paid", paid_at: new Date().toISOString() }, { action: "payment_status_updated", entityType: "payment", entityLabel: payment.bookings?.booking_ref ?? payment.id, details: { status: "Paid" } })}>Paid</Button>
                    <Button variant="ghost" onClick={() => updateRecord("payments", payment.id, { status: "Failed" }, { action: "payment_status_updated", entityType: "payment", entityLabel: payment.bookings?.booking_ref ?? payment.id, details: { status: "Failed" } })}>Failed</Button>
                    <Button variant="ghost" onClick={() => updateRecord("payments", payment.id, { status: "Refunded" }, { action: "payment_status_updated", entityType: "payment", entityLabel: payment.bookings?.booking_ref ?? payment.id, details: { status: "Refunded" } })}>Refunded</Button>
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
              {filteredProofs.length === 0 ? <EmptyState title="No proofs found" detail="Try another payment search." /> : null}
              {filteredProofs.map((proof) => (
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
        <section className="card">
          <div className="card-head"><h3>Partner inquiries</h3><Building2 size={20} /></div>
          <div className="admin-filter-bar">
            <input value={tableFilters.inquiriesQuery} onChange={(event) => setTableFilter("inquiriesQuery", event.target.value)} placeholder="Search inquiries" />
            <select value={tableFilters.inquiriesCity} onChange={(event) => setTableFilter("inquiriesCity", event.target.value)}>
              <option value="">All preferred cities</option>
              {cities.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
            </select>
          </div>
          <div className="admin-table">
            {filteredPartnerInquiries.length === 0 ? <EmptyState title="No inquiries found" detail="Try another search or city filter." /> : null}
            {filteredPartnerInquiries.map((inquiry) => (
              <article key={inquiry.id} className="admin-row compact">
                <div><strong>{inquiry.name}</strong><span>{inquiry.inquiry_type} - {inquiry.organisation ?? inquiry.campus ?? "No organisation"}</span></div>
                <div><span>{inquiry.preferred_city ?? "Any city"}</span><span>{formatDate(inquiry.created_at)}</span></div>
                <a href={`mailto:${inquiry.email}`}>Email</a>
                {inquiry.phone ? <a href={`https://wa.me/${inquiry.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a> : <span>No phone</span>}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Cities" ? (
        <section className="card">
          <div className="card-head">
            <h3>Cities</h3>
            <Button onClick={() => openCityForm()}>Add City</Button>
          </div>
          <div className="admin-filter-bar">
            <input value={tableFilters.citiesQuery} onChange={(event) => setTableFilter("citiesQuery", event.target.value)} placeholder="Search cities" />
          </div>
          <div className="admin-data-table admin-data-table-cities">
            <div className="admin-table-head admin-table-row-city">
              <span>City</span>
              <span>Province</span>
              <span>Support</span>
              <span>Trips</span>
              <span>Actions</span>
            </div>
            {filteredCities.length === 0 ? <EmptyState title="No cities found" detail="Try another city search." /> : null}
            {filteredCities.map((city) => (
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

      {showBranchManagerModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-branch-manager-title">
            <div className="card-head">
              <div>
                <h3 id="add-branch-manager-title">{editingBranchManagerId ? "Edit Branch Manager" : "Add Branch Manager"}</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label className="admin-modal-full">
                Account email
                <input value={branchManagerForm.email} onChange={(event) => setBranchManagerFormValue("email", event.target.value)} placeholder="manager@studenttrips.co.za" readOnly={Boolean(editingBranchManagerId)} />
              </label>
              <label className="admin-modal-full">
                Branch city
                <select value={branchManagerForm.branch_city_id} onChange={(event) => setBranchManagerFormValue("branch_city_id", event.target.value)}>
                  <option value="">Choose branch city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                First name
                <input value={branchManagerForm.first_name} onChange={(event) => setBranchManagerFormValue("first_name", event.target.value)} placeholder="Anele" />
              </label>
              <label>
                Last name
                <input value={branchManagerForm.last_name} onChange={(event) => setBranchManagerFormValue("last_name", event.target.value)} placeholder="Mokoena" />
              </label>
              <label>
                Phone
                <input value={branchManagerForm.phone} onChange={(event) => setBranchManagerFormValue("phone", event.target.value)} placeholder="+27 79 707 5710" />
              </label>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowBranchManagerModal(false); resetBranchManagerForm(); }}>Cancel</Button>
              <Button onClick={createBranchManager} disabled={saving === "branch-manager-create" || saving === `branch-manager-${editingBranchManagerId}`}>
                {saving === "branch-manager-create" || saving === `branch-manager-${editingBranchManagerId}` ? "Saving..." : editingBranchManagerId ? "Save Branch Manager" : "Add Branch Manager"}
              </Button>
            </div>
          </section>
        </div>
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

      {showProfileModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
            <div className="card-head">
              <div>
                <h3 id="edit-profile-title">Edit User</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label>
                First name
                <input value={profileForm.first_name} onChange={(event) => setProfileFormValue("first_name", event.target.value)} placeholder="First name" />
              </label>
              <label>
                Last name
                <input value={profileForm.last_name} onChange={(event) => setProfileFormValue("last_name", event.target.value)} placeholder="Last name" />
              </label>
              <label>
                Phone
                <input value={profileForm.phone} onChange={(event) => setProfileFormValue("phone", event.target.value)} placeholder="+27 79 707 5710" />
              </label>
              <label>
                Role
                <select value={profileForm.role} onChange={(event) => setProfileFormValue("role", event.target.value)}>
                  <option value="customer">customer</option>
                  <option value="branch">branch</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label>
                University
                <input value={profileForm.campus} onChange={(event) => setProfileFormValue("campus", event.target.value)} placeholder="University" />
              </label>
              <label>
                Organisation
                <input value={profileForm.organisation} onChange={(event) => setProfileFormValue("organisation", event.target.value)} placeholder="Organisation" />
              </label>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowProfileModal(false); resetProfileForm(); }}>Cancel</Button>
              <Button onClick={saveProfileForm} disabled={saving === `profiles-${editingProfileId}`}>
                {saving === `profiles-${editingProfileId}` ? "Saving..." : "Save User"}
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
              <div className="admin-pricing-note admin-modal-full">
                <strong>Pricing setup</strong>
                <p>Community price is for returning travelers with 1 or more previous bookings. Non-community price is for first-time or guest bookings. Compare-at / original price is optional and only used when you want a crossed-out promo price above the live selling prices.</p>
              </div>
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
                Community price
                <input type="number" min="0" step="0.01" value={tripForm.community_price} onChange={(event) => setTripFormValue("community_price", event.target.value)} placeholder="3499" />
                <span className="admin-field-note">Used for returning travelers.</span>
              </label>
              <label>
                Non-community price
                <input type="number" min="0" step="0.01" value={tripForm.non_community_price} onChange={(event) => setTripFormValue("non_community_price", event.target.value)} placeholder="3999" />
                <span className="admin-field-note">Shown to guests and first-time bookers.</span>
              </label>
              <label>
                Compare-at / original price
                <input type="number" min="0" step="0.01" value={tripForm.compare_price} onChange={(event) => setTripFormValue("compare_price", event.target.value)} placeholder="4299" />
                <span className="admin-field-note">Optional crossed-out promo price.</span>
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
              <label className="admin-check">
                Special trip
                <input type="checkbox" checked={tripForm.is_special} onChange={(event) => setTripFormValue("is_special", event.target.checked)} />
              </label>
              <label>
                Special collection
                <input
                  value={tripForm.special_collection_slug}
                  onChange={(event) => setTripFormValue("special_collection_slug", event.target.value)}
                  placeholder={tripForm.title ? `${slugify(tripForm.title)}-specials` : "winter-specials"}
                />
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
                </div>
                {selectedCityPickupPoints.length > 0 ? (
                  <>
                    <p className="admin-field-note">Choose the city pickup points this trip should allow, then select which one is the main meeting point.</p>
                    <div className="admin-pickup-groups">
                      {Object.entries(groupedSelectedCityPickupPoints).map(([area, points]) => (
                        <section key={area} className="admin-pickup-group">
                          <strong>{area}</strong>
                          <div className="admin-pickup-checklist">
                            {points.map((point) => (
                              <label key={point.id} className="admin-pickup-option">
                                <input
                                  type="checkbox"
                                  checked={tripForm.pickup_points.includes(point.point)}
                                  onChange={() => toggleTripPickupPoint(point.point)}
                                />
                                <span>{point.point}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <label>
                      Main meeting point
                      <select value={tripForm.meeting_point} onChange={(event) => setTripFormValue("meeting_point", event.target.value)}>
                        <option value="">Choose main meeting point</option>
                        {tripForm.pickup_points.filter(Boolean).map((point) => (
                          <option key={point} value={point}>{point}</option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <p className="admin-field-note">No structured pickup points found for this city yet. Add them manually below for now.</p>
                    <div className="admin-pickup-points-head">
                      <button type="button" onClick={addTripPickupPoint}>Add pickup point</button>
                    </div>
                    {tripForm.pickup_points.map((point, index) => (
                      <label key={index}>
                        Pickup point {index + 1}
                        <span className="admin-pickup-point-row">
                          <input value={point} onChange={(event) => setTripPickupPoint(index, event.target.value)} placeholder={index === 0 ? "Cape Town Station" : "UCT upper university pickup"} />
                          <button type="button" onClick={() => removeTripPickupPoint(index)}>Remove</button>
                        </span>
                      </label>
                    ))}
                  </>
                )}
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
          <div className="card-head">
            <h3>Updates</h3>
            <Button onClick={() => openUpdateForm()}>Add Update</Button>
          </div>
          <div className="admin-filter-bar">
            <input value={tableFilters.updatesQuery} onChange={(event) => setTableFilter("updatesQuery", event.target.value)} placeholder="Search updates" />
          </div>
          <div className="admin-data-table admin-data-table-updates">
            <div className="admin-table-head admin-table-row-update">
              <span>Update</span>
              <span>Published on</span>
              <span>State</span>
              <span>Actions</span>
            </div>
            {filteredUpdates.length === 0 ? <EmptyState title="No updates found" detail="Try another update search." /> : null}
            {filteredUpdates.map((update) => (
              <article key={update.id} className="admin-table-row admin-table-row-update">
                <div><strong>{update.title}</strong><span>{update.body}{update.banner_special_collection_slug ? ` -> ${update.banner_special_collection_slug}` : ""}</span></div>
                <div><strong>{formatDate(update.published_on)}</strong><span>{formatDate(update.created_at)}</span></div>
                <StatusBadge status={update.published ? "Published" : "Draft"} />
                <div className="admin-actions">
                  <Button variant="secondary" onClick={() => openUpdateForm(update)}>Edit</Button>
                  <Button variant="ghost" onClick={() => deleteRecord("updates", update.id, update.title)}>Delete</Button>
                </div>
              </article>
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
          <div className="admin-filter-bar">
            <input value={tableFilters.reviewsQuery} onChange={(event) => setTableFilter("reviewsQuery", event.target.value)} placeholder="Search reviews" />
            <select value={tableFilters.reviewsState} onChange={(event) => setTableFilter("reviewsState", event.target.value)}>
              <option value="">All states</option>
              <option value="Published">Published</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="admin-data-table admin-data-table-reviews">
            <div className="admin-table-head admin-table-row-review">
              <span>Author</span>
              <span>Review</span>
              <span>Trip</span>
              <span>State</span>
              <span>Actions</span>
            </div>
            {filteredReviews.length === 0 ? <EmptyState title="No reviews found" detail="Try another search or review state." /> : null}
            {filteredReviews.map((review) => (
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
                    {!review.published ? <Button variant="secondary" onClick={() => updateRecord("reviews", review.id, { published: true }, { action: "review_published", entityType: "review", entityLabel: review.author_name, details: { published: true } })}>Approve</Button> : null}
                    {review.published ? <Button variant="ghost" onClick={() => updateRecord("reviews", review.id, { published: false }, { action: "review_hidden", entityType: "review", entityLabel: review.author_name, details: { published: false } })}>Hide</Button> : null}
                    <Button variant="secondary" onClick={() => openReviewForm(review)}>Edit</Button>
                    <Button variant="ghost" onClick={() => deleteRecord("reviews", review.id, review.author_name)}>Delete</Button>
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && activeTab === "Logs" ? (
        <section className="card">
          <div className="card-head">
            <h3>Activity Logs</h3>
          </div>
          <div className="admin-filter-bar">
            <input value={tableFilters.logsQuery} onChange={(event) => setTableFilter("logsQuery", event.target.value)} placeholder="Search logs" />
          </div>
          <div className="admin-data-table admin-data-table-logs">
            <div className="admin-table-head admin-table-row-log">
              <span>When</span>
              <span>Actor</span>
              <span>Action</span>
              <span>Record</span>
            </div>
            {filteredActivityLogs.length === 0 ? <EmptyState title="No logs found" detail="Try another log search." /> : null}
            {filteredActivityLogs.map((log) => (
              <article key={log.id} className="admin-table-row admin-table-row-log">
                <div>
                  <strong>{formatDate(log.created_at)}</strong>
                  <span>{new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div>
                  <strong>{[log.profiles?.first_name, log.profiles?.last_name].filter(Boolean).join(" ").trim() || log.profiles?.email || "Staff user"}</strong>
                  <span>{log.actor_role ?? "staff"}</span>
                </div>
                <div>
                  <strong>{log.action.replace(/_/g, " ")}</strong>
                  <span>{log.entity_type.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <strong>{log.entity_label ?? log.entity_id ?? "Record"}</strong>
                  <span>{log.details && Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "No extra details"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showUpdateModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-update-title">
            <div className="card-head">
              <div>
                <h3 id="add-update-title">{editingUpdateId ? "Edit Update" : "Add Update"}</h3>
              </div>
            </div>

            <div className="admin-modal-grid">
              <label className="admin-modal-full">
                Title
                <input value={updateForm.title} onChange={(event) => setUpdateFormValue("title", event.target.value)} placeholder="New route added" />
              </label>
              <label>
                Published on
                <input type="date" value={updateForm.published_on} onChange={(event) => setUpdateFormValue("published_on", event.target.value)} />
              </label>
              <label>
                Banner trip collection
                <input
                  value={updateForm.banner_special_collection_slug}
                  onChange={(event) => setUpdateFormValue("banner_special_collection_slug", event.target.value)}
                  placeholder="winter-specials"
                />
              </label>
              <label className="admin-modal-full">
                Body
                <textarea value={updateForm.body} onChange={(event) => setUpdateFormValue("body", event.target.value)} rows={4} placeholder="Share the update customers should see." />
              </label>
            </div>

            <div className="admin-modal-actions">
              <Button variant="secondary" onClick={() => { setShowUpdateModal(false); resetUpdateForm(); }}>Cancel</Button>
              <Button onClick={createUpdate} disabled={saving === "updates-create" || saving === `updates-${editingUpdateId}`}>
                {saving === "updates-create" || saving === `updates-${editingUpdateId}` ? "Saving..." : editingUpdateId ? "Save Update" : "Add Update"}
              </Button>
            </div>
          </section>
        </div>
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
