import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "./supabase";
import type { Trip } from "./types";

type PricingTier = "guest" | "first-time" | "community";

type ResolvedTripPricing = {
  comparePrice: number | null;
  deposit: number;
  price: number;
  tier: PricingTier;
};

type PricingContextValue = {
  pricingTier: PricingTier;
  refreshPricingTier: () => Promise<void>;
  resolveTripPricing: (trip: Trip) => ResolvedTripPricing;
};

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [pricingTier, setPricingTier] = useState<PricingTier>("guest");

  const refreshPricingTier = useCallback(async () => {
    if (!supabase) {
      setPricingTier("guest");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPricingTier("guest");
      return;
    }

    const { count, error: bookingError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (bookingError) {
      setPricingTier("first-time");
      return;
    }

    setPricingTier((count ?? 0) > 0 ? "community" : "first-time");
  }, []);

  useEffect(() => {
    refreshPricingTier();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshPricingTier();
    });

    return () => subscription.unsubscribe();
  }, [refreshPricingTier]);

  const value = useMemo<PricingContextValue>(() => {
    const resolveTripPricing = (trip: Trip): ResolvedTripPricing => {
      const communityPrice = trip.communityPrice ?? trip.price;
      const nonCommunityPrice = trip.nonCommunityPrice ?? trip.originalPrice ?? communityPrice;

      if (pricingTier === "community") {
        return {
          price: communityPrice,
          comparePrice:
            trip.originalPrice && trip.originalPrice > communityPrice
              ? trip.originalPrice
              : nonCommunityPrice > communityPrice
                ? nonCommunityPrice
                : null,
          deposit: trip.deposit,
          tier: pricingTier,
        };
      }

      return {
        price: nonCommunityPrice,
        comparePrice: trip.originalPrice && trip.originalPrice > nonCommunityPrice ? trip.originalPrice : null,
        deposit: trip.deposit,
        tier: pricingTier,
      };
    };

    return {
      pricingTier,
      refreshPricingTier,
      resolveTripPricing,
    };
  }, [pricingTier, refreshPricingTier]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const context = useContext(PricingContext);

  if (!context) {
    throw new Error("usePricing must be used within a PricingProvider.");
  }

  return context;
}
