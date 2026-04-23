import { useEffect, useState } from "react";

import { AdminScreen } from "./screens/Admin/AdminScreen";
import { AuthScreen } from "./screens/Auth/AuthScreen";
import { BookingScreen } from "./screens/Booking/BookingScreen";
import { BranchScreen } from "./screens/Branch/BranchScreen";
import type { CityDestination } from "./screens/Cities/CitiesScreen";
import { CitiesScreen } from "./screens/Cities/CitiesScreen";
import { CityDetailScreen } from "./screens/Cities/CityDetailScreen";
import { ContactScreen } from "./screens/Contact/ContactScreen";
import { CustomerScreen } from "./screens/Customer/CustomerScreen";
import { FaqScreen } from "./screens/Faq/FaqScreen";
import { HomeScreen } from "./screens/Home/HomeScreen";
import { OnboardingScreen } from "./screens/Onboarding/OnboardingScreen";
import { PartnerScreen } from "./screens/Partner/PartnerScreen";
import { PolicyScreen } from "./screens/Policy/PolicyScreen";
import { TripDetailScreen } from "./screens/Trips/TripDetailScreen";
import { TripsScreen } from "./screens/Trips/TripsScreen";
import { UpdatesScreen } from "./screens/Updates/UpdatesScreen";
import { CurrencyProvider } from "./lib/currency";
import { dbTripToTrip, tripSelect, type DbTrip } from "./lib/db";
import { supabase } from "./lib/supabase";
import type { Trip } from "./lib/types";
import { FloatingChatButton } from "./shared/components/FloatingChatButton";
import { AppHeader } from "./shared/layout/AppHeader";
import { SiteFooter } from "./shared/layout/SiteFooter";
import type { View } from "./shared/navigation";

type UserRole = "customer" | "branch" | "admin";

type UserProfileStatus = {
  role: UserRole;
  profileCompletePercent: number;
};

export type TripFilters = {
  query?: string;
  city?: string;
  category?: string;
  specialCollection?: string;
  label?: string;
};

const savedViewKey = "student-trips:last-view";
const savedTripKey = "student-trips:selected-trip";
const savedCityKey = "student-trips:selected-city";
const protectedViews = new Set<View>(["customer", "admin", "branch", "onboarding"]);
const authRequiredViews = new Set<View>(["customer", "admin", "branch", "onboarding", "booking"]);
const persistentViews = new Set<View>([
  "home",
  "trips",
  "tripDetail",
  "booking",
  "cities",
  "cityDetail",
  "faq",
  "updates",
  "partner",
  "contact",
  "login",
  "register",
  "onboarding",
  "resetPassword",
  "updatePassword",
  "terms",
  "privacy",
  "refund",
  "accessibility",
  "waiver",
  "customer",
  "admin",
  "branch",
]);

type RouteState = {
  citySlug: string | null;
  tripSlug: string | null;
  view: View;
};

const staticViewPaths: Partial<Record<View, string>> = {
  home: "/",
  trips: "/trips",
  cities: "/cities",
  faq: "/faq",
  updates: "/updates",
  partner: "/partners",
  contact: "/contact",
  login: "/login",
  register: "/register",
  onboarding: "/onboarding",
  resetPassword: "/reset-password",
  updatePassword: "/update-password",
  terms: "/terms",
  privacy: "/privacy",
  refund: "/refund-policy",
  accessibility: "/accessibility-statement",
  waiver: "/waiver-policy",
  customer: "/dashboard",
  admin: "/admin",
  branch: "/branch",
};

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function getRouteFromPathname(pathname: string): RouteState {
  const normalizedPath = normalizePathname(pathname);
  const tripBookingMatch = normalizedPath.match(/^\/trips\/([^/]+)\/book$/);
  if (tripBookingMatch) {
    return { view: "booking", tripSlug: decodeURIComponent(tripBookingMatch[1]), citySlug: null };
  }

  const tripDetailMatch = normalizedPath.match(/^\/trips\/([^/]+)$/);
  if (tripDetailMatch) {
    return { view: "tripDetail", tripSlug: decodeURIComponent(tripDetailMatch[1]), citySlug: null };
  }

  const cityDetailMatch = normalizedPath.match(/^\/cities\/([^/]+)$/);
  if (cityDetailMatch) {
    return { view: "cityDetail", citySlug: decodeURIComponent(cityDetailMatch[1]), tripSlug: null };
  }

  const matchedView = (Object.entries(staticViewPaths).find(([, path]) => path === normalizedPath)?.[0] as View | undefined) ?? "home";
  return { view: matchedView, tripSlug: null, citySlug: null };
}

function getInitialRoute(): RouteState {
  try {
    return getRouteFromPathname(window.location.pathname);
  } catch {
    return { view: getSavedView(), tripSlug: null, citySlug: null };
  }
}

function getPathForView(view: View, selectedTrip: Trip | null, selectedCity: CityDestination | null, routeTripSlug: string | null, routeCitySlug: string | null) {
  if (view === "tripDetail") {
    const tripSlug = selectedTrip?.slug ?? routeTripSlug;
    return tripSlug ? `/trips/${encodeURIComponent(tripSlug)}` : "/trips";
  }

  if (view === "booking") {
    const tripSlug = selectedTrip?.slug ?? routeTripSlug;
    return tripSlug ? `/trips/${encodeURIComponent(tripSlug)}/book` : "/booking";
  }

  if (view === "cityDetail") {
    const citySlug = selectedCity?.slug ?? routeCitySlug;
    return citySlug ? `/cities/${encodeURIComponent(citySlug)}` : "/cities";
  }

  return staticViewPaths[view] ?? "/";
}

function getSavedView(): View {
  try {
    const savedView = window.localStorage.getItem(savedViewKey) as View | null;
    return savedView && persistentViews.has(savedView) ? savedView : "home";
  } catch {
    return "home";
  }
}

function getSavedJson<T>(key: string): T | null {
  try {
    const savedValue = window.localStorage.getItem(key);
    return savedValue ? (JSON.parse(savedValue) as T) : null;
  } catch {
    return null;
  }
}

function saveJson<T>(key: string, value: T | null) {
  try {
    if (value) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }

    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep the in-memory navigation working.
  }
}

export function App() {
  const initialRoute = getInitialRoute();
  const [view, setViewState] = useState<View>(initialRoute.view);
  const [routeCitySlug, setRouteCitySlug] = useState<string | null>(initialRoute.citySlug);
  const [routeTripSlug, setRouteTripSlug] = useState<string | null>(initialRoute.tripSlug);
  const [selectedCity, setSelectedCityState] = useState<CityDestination | null>(() => getSavedJson<CityDestination>(savedCityKey));
  const [selectedTrip, setSelectedTripState] = useState<Trip | null>(() => getSavedJson<Trip>(savedTripKey));
  const [tripFilters, setTripFilters] = useState<TripFilters>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("customer");

  const setView = (nextView: View) => {
    setViewState(nextView);
    const nextPath = getPathForView(nextView, selectedTrip, selectedCity, routeTripSlug, routeCitySlug);
    try {
      if (persistentViews.has(nextView)) {
        window.localStorage.setItem(savedViewKey, nextView);
      }

      if (normalizePathname(window.location.pathname) !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    } catch {
      // Ignore storage failures and keep the in-memory navigation working.
    }
  };

  const setSelectedCity = (city: CityDestination | null) => {
    setSelectedCityState(city);
    setRouteCitySlug(city?.slug ?? null);
    saveJson(savedCityKey, city);
  };

  const setSelectedTrip = (trip: Trip | null) => {
    setSelectedTripState(trip);
    setRouteTripSlug(trip?.slug ?? null);
    saveJson(savedTripKey, trip);
  };

  const getDashboardView = (role: UserRole = userRole): View => {
    if (role === "admin") return "admin";
    if (role === "branch") return "branch";
    return "customer";
  };

  const loadUserProfileStatus = async (): Promise<UserProfileStatus> => {
    const fallback = { role: "customer", profileCompletePercent: 0 } satisfies UserProfileStatus;

    if (!supabase) return fallback;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return fallback;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data } = await supabase.from("profiles").select("role,profile_complete_percent").eq("id", user.id).maybeSingle();

      if (data?.role) {
        const role = data.role as UserRole;
        setUserRole(role);
        return { role, profileCompletePercent: data.profile_complete_percent ?? 0 };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    setUserRole("customer");
    return fallback;
  };

  const loadUserRole = async () => {
    const profileStatus = await loadUserProfileStatus();
    return profileStatus.role;
  };

  const getPostLoginView = async () => {
    const { role, profileCompletePercent } = await loadUserProfileStatus();
    if (role !== "customer") return getDashboardView(role);
    if (profileCompletePercent < 100) return "onboarding" satisfies View;
    return getDashboardView(role);
  };

  const handleDashboardClick = async () => {
    if (!isLoggedIn) {
      setView("login");
      return;
    }

    const destinationView = await getPostLoginView();
    setView(destinationView);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  useEffect(() => {
    if ((view === "tripDetail" || view === "booking") && !selectedTrip && !routeTripSlug) {
      setView("trips");
    }

    if (view === "cityDetail" && !selectedCity && !routeCitySlug) {
      setView("cities");
    }
  }, [routeCitySlug, routeTripSlug, selectedCity, selectedTrip, view]);

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPathname(window.location.pathname);
      setViewState(route.view);
      setRouteTripSlug(route.tripSlug);
      setRouteCitySlug(route.citySlug);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const desiredPath = getPathForView(view, selectedTrip, selectedCity, routeTripSlug, routeCitySlug);
    if (normalizePathname(window.location.pathname) !== desiredPath) {
      window.history.replaceState({}, "", desiredPath);
    }
  }, [routeCitySlug, routeTripSlug, selectedCity, selectedTrip, view]);

  useEffect(() => {
    let active = true;

    async function loadTripFromRoute() {
      if ((view !== "tripDetail" && view !== "booking") || !routeTripSlug || selectedTrip?.slug === routeTripSlug || !supabase) {
        return;
      }

      const { data } = await supabase.from("trips").select(tripSelect).eq("published", true).eq("slug", routeTripSlug).maybeSingle();
      if (!active) return;

      if (data) {
        setSelectedTrip(dbTripToTrip(data as unknown as DbTrip));
        return;
      }

      setViewState("trips");
      setRouteTripSlug(null);
    }

    loadTripFromRoute();

    return () => {
      active = false;
    };
  }, [routeTripSlug, selectedTrip?.slug, view]);

  useEffect(() => {
    let active = true;

    async function loadCityFromRoute() {
      if (view !== "cityDetail" || !routeCitySlug || selectedCity?.slug === routeCitySlug || !supabase) {
        return;
      }

      const { data } = await supabase
        .from("cities")
        .select("id,slug,name,province,image_url,tagline,support_email,support_phone,trips(count)")
        .eq("active", true)
        .eq("slug", routeCitySlug)
        .maybeSingle();

      if (!active) return;

      if (data) {
        const city = data as unknown as CityDestination;
        setSelectedCity({
          ...city,
          tripCount: city.trips?.[0]?.count ?? 0,
        });
        return;
      }

      setViewState("cities");
      setRouteCitySlug(null);
    }

    loadCityFromRoute();

    return () => {
      active = false;
    };
  }, [routeCitySlug, selectedCity?.slug, view]);

  useEffect(() => {
    if (!isLoggedIn && authRequiredViews.has(view)) {
      setView(view === "booking" ? "login" : "home");
    }
  }, [isLoggedIn, view]);

  useEffect(() => {
    if (!supabase) {
      setIsLoggedIn(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (mounted) {
        setIsLoggedIn(Boolean(data.session));
        if (data.session) {
          await loadUserRole();
        } else if (protectedViews.has(view) || view === "booking") {
          setView(view === "booking" ? "login" : "home");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(Boolean(session));

      if (event === "PASSWORD_RECOVERY") {
        setView("updatePassword");
      }

      if (session) {
        loadUserRole();
      } else {
        setUserRole("customer");
        if (event === "SIGNED_OUT" || authRequiredViews.has(view)) {
          setView(view === "booking" ? "login" : "home");
        }
      }
    });

    const authParams = new URLSearchParams(window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, ""));
    if (authParams.get("type") === "recovery") {
      setView("updatePassword");
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setIsLoggedIn(false);
    setUserRole("customer");
    setView("home");
  };

  const handleLoggedIn = async () => {
    setIsLoggedIn(true);
    return getPostLoginView();
  };

  const handleViewCityTrips = async (trip: Trip) => {
    if (!supabase) {
      setView("cities");
      return;
    }

    const { data } = await supabase
      .from("cities")
      .select("id,slug,name,province,image_url,tagline,support_email,support_phone,trips(count)")
      .eq("active", true)
      .eq("name", trip.city)
      .maybeSingle();

    if (data) {
      const city = data as unknown as CityDestination;
      setSelectedCity({
        ...city,
        tripCount: city.trips?.[0]?.count ?? 0,
      });
      setView("cityDetail");
      return;
    }

    setView("cities");
  };

  const handleOpenCityByName = async (cityName: string) => {
    if (!supabase) {
      setView("cities");
      return;
    }

    const { data } = await supabase
      .from("cities")
      .select("id,slug,name,province,image_url,tagline,support_email,support_phone,trips(count)")
      .eq("active", true)
      .eq("name", cityName)
      .maybeSingle();

    if (data) {
      const city = data as unknown as CityDestination;
      setSelectedCity({
        ...city,
        tripCount: city.trips?.[0]?.count ?? 0,
      });
      setView("cityDetail");
      return;
    }

    setView("cities");
  };

  return (
    <CurrencyProvider>
      <AppHeader activeView={view} isLoggedIn={isLoggedIn} onDashboardClick={handleDashboardClick} onSignOut={handleSignOut} setView={setView} />
      {view === "home" ? <HomeScreen onTripSearch={setTripFilters} onViewCityTrips={handleViewCityTrips} setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "trips" ? <TripsScreen initialFilters={tripFilters} onViewCityTrips={handleViewCityTrips} setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "tripDetail" ? <TripDetailScreen trip={selectedTrip} isLoggedIn={isLoggedIn} setView={setView} /> : null}
      {view === "booking" ? <BookingScreen trip={selectedTrip} setView={setView} /> : null}
      {view === "cities" ? <CitiesScreen setView={setView} setSelectedCity={setSelectedCity} /> : null}
      {view === "cityDetail" ? <CityDetailScreen city={selectedCity} setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "faq" ? <FaqScreen /> : null}
      {view === "updates" ? <UpdatesScreen /> : null}
      {view === "partner" ? <PartnerScreen /> : null}
      {view === "contact" ? <ContactScreen /> : null}
      {view === "login" ? <AuthScreen mode="login" onLoggedIn={handleLoggedIn} setView={setView} /> : null}
      {view === "register" ? <AuthScreen mode="register" onLoggedIn={handleLoggedIn} setView={setView} /> : null}
      {view === "onboarding" ? <OnboardingScreen setView={setView} /> : null}
      {view === "resetPassword" ? <AuthScreen mode="resetPassword" onLoggedIn={handleLoggedIn} setView={setView} /> : null}
      {view === "updatePassword" ? <AuthScreen mode="updatePassword" onLoggedIn={handleLoggedIn} setView={setView} /> : null}
      {view === "terms" ? <PolicyScreen policy="terms" /> : null}
      {view === "privacy" ? <PolicyScreen policy="privacy" /> : null}
      {view === "refund" ? <PolicyScreen policy="refund" /> : null}
      {view === "accessibility" ? <PolicyScreen policy="accessibility" /> : null}
      {view === "waiver" ? <PolicyScreen policy="waiver" /> : null}
      {view === "customer" ? <CustomerScreen onViewCityTrips={handleViewCityTrips} setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "admin" ? <AdminScreen /> : null}
      {view === "branch" ? <BranchScreen /> : null}
      <SiteFooter activeView={view} onCityClick={handleOpenCityByName} setView={setView} />
      <FloatingChatButton />
    </CurrencyProvider>
  );
}
