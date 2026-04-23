import { CalendarDays, Heart, MapPin, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { useCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/data";
import { supabase } from "../../lib/supabase";
import { getTripBadges } from "../../lib/tripBadges";
import type { Trip } from "../../lib/types";
import { cx } from "../utils/cx";

export function TripCard({
  trip,
  compact = false,
  hideCityAction = false,
  initialSaved = false,
  onFavoriteChange,
  onViewCityTrips,
  onViewTrip,
}: {
  trip: Trip;
  compact?: boolean;
  hideCityAction?: boolean;
  initialSaved?: boolean;
  onFavoriteChange?: (trip: Trip, saved: boolean) => void;
  onViewCityTrips?: (trip: Trip) => void;
  onViewTrip?: (trip: Trip) => void;
}) {
  const { formatTripMoney } = useCurrency();
  const nearlyFull = trip.status === "NEARLY_FULL";
  const soldOut = trip.status === "SOLD_OUT";
  const badges = getTripBadges(trip);
  const [canSaveFavorite, setCanSaveFavorite] = useState(false);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [savingFavorite, setSavingFavorite] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSavedState() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) {
        if (mounted) setCanSaveFavorite(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const isCustomer = profile?.role === "customer";

      if (!mounted) return;
      setCanSaveFavorite(isCustomer);

      if (!isCustomer) return;
      const { data } = await supabase.from("saved_trips").select("trip_id").eq("user_id", user.id).eq("trip_id", trip.id).maybeSingle();
      if (mounted) setIsSaved(Boolean(data));
    }

    loadSavedState();

    return () => {
      mounted = false;
    };
  }, [trip.id]);

  const toggleFavorite = async () => {
    if (!supabase || savingFavorite || !canSaveFavorite) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCanSaveFavorite(false);
      return;
    }

    setSavingFavorite(true);

    if (isSaved) {
      const { error } = await supabase.from("saved_trips").delete().eq("user_id", user.id).eq("trip_id", trip.id);
      if (!error) {
        setIsSaved(false);
        onFavoriteChange?.(trip, false);
      }
    } else {
      const { error } = await supabase.from("saved_trips").upsert({ user_id: user.id, trip_id: trip.id });
      if (!error) {
        setIsSaved(true);
        onFavoriteChange?.(trip, true);
      }
    }

    setSavingFavorite(false);
  };

  return (
    <article className={cx("card trip-card", compact && "compact")}>
      <div className="trip-image-wrap">
        <img src={trip.image} alt={`${trip.title} destination`} className="trip-image" />
        <div className="image-shade" />
        <button
          className={cx("trip-save-button", isSaved && "saved", !canSaveFavorite && "locked")}
          type="button"
          aria-label={canSaveFavorite ? (isSaved ? "Remove saved trip" : "Save trip") : "Log in as a customer to save this trip"}
          aria-pressed={isSaved}
          disabled={savingFavorite || !canSaveFavorite}
          onClick={toggleFavorite}
          title={canSaveFavorite ? (isSaved ? "Remove saved trip" : "Save trip") : "Customer login required"}
        >
          <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
        </button>
        <div className="badge-row">
          {soldOut ? <span className="danger-badge">Sold Out</span> : nearlyFull ? <span className="danger-badge">Almost Full</span> : null}
          {badges.map((badge) => (
            <span key={badge} className={badge.toLowerCase() === "featured" ? "feature-badge" : "light-badge"}>
              <Sparkles size={13} />
              {badge}
            </span>
          ))}
        </div>
        <div className="trip-image-copy">
          <span className="trip-status-pill">{soldOut ? "Sold Out" : nearlyFull ? "Nearly Full" : "Open"}</span>
          <strong>{trip.category}</strong>
        </div>
      </div>

      <div className="trip-content">
        <div className="meta-row">
          <span>
            <MapPin size={14} />
            {trip.city}
          </span>
          <span>{trip.category}</span>
        </div>
        <h3 className="font-display">{trip.title}</h3>
        <p>{trip.summary}</p>
        <div className="trip-facts">
          <span>
            <CalendarDays size={15} />
            {formatDate(trip.startDate)}
          </span>
          <span>
            <Users size={15} />
            {trip.seatsRemaining} seats left
          </span>
          <strong>From {formatTripMoney(trip.price)}</strong>
          <strong>Deposit {formatTripMoney(trip.deposit)}</strong>
        </div>
        <div className="trip-card-actions">
          <button type="button" onClick={() => onViewTrip?.(trip)}>View Trip</button>
          {!hideCityAction ? <button type="button" onClick={() => onViewCityTrips?.(trip)}>See city trips</button> : null}
        </div>
      </div>
    </article>
  );
}
