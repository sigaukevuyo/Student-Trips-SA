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

const savedViewKey = "student-trips:last-view";
const protectedViews = new Set<View>(["customer", "admin", "branch", "onboarding"]);
const persistentViews = new Set<View>([
  "home",
  "trips",
  "cities",
  "faq",
  "updates",
  "partner",
  "contact",
  "onboarding",
  "terms",
  "privacy",
  "refund",
  "accessibility",
  "waiver",
  "customer",
  "admin",
  "branch",
]);

function getSavedView(): View {
  try {
    const savedView = window.localStorage.getItem(savedViewKey) as View | null;
    return savedView && persistentViews.has(savedView) ? savedView : "home";
  } catch {
    return "home";
  }
}

export function App() {
  const [view, setViewState] = useState<View>(getSavedView);
  const [selectedCity, setSelectedCity] = useState<CityDestination | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("customer");

  const setView = (nextView: View) => {
    setViewState(nextView);
    try {
      if (persistentViews.has(nextView)) {
        window.localStorage.setItem(savedViewKey, nextView);
      }
    } catch {
      // Ignore storage failures and keep the in-memory navigation working.
    }
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
        } else if (protectedViews.has(view)) {
          setView("home");
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

  return (
    <>
      <AppHeader activeView={view} isLoggedIn={isLoggedIn} onDashboardClick={handleDashboardClick} onSignOut={handleSignOut} setView={setView} />
      {view === "home" ? <HomeScreen setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "trips" ? <TripsScreen setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "tripDetail" ? <TripDetailScreen trip={selectedTrip} setView={setView} /> : null}
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
      {view === "customer" ? <CustomerScreen setSelectedTrip={setSelectedTrip} setView={setView} /> : null}
      {view === "admin" ? <AdminScreen /> : null}
      {view === "branch" ? <BranchScreen /> : null}
      <SiteFooter activeView={view} setView={setView} />
      <FloatingChatButton />
    </>
  );
}
