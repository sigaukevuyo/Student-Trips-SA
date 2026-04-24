import { CalendarDays, CheckCircle2, Clock, FileUp, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/data";
import { friendlyError } from "../../lib/friendlyError";
import { usePricing } from "../../lib/pricing";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import type { View } from "../../shared/navigation";
import "./BookingScreen.css";

const steps = ["Traveler setup", "Review details", "Bank details", "Payment proof"];
const proofBucket = "payment-proofs";
const maxTravelersPerBooking = 8;
const bankDetails = [
  { label: "Account name", value: "YEBOGO SA (PTY) LTD" },
  { label: "Bank", value: "First National Bank (FNB)" },
  { label: "Account number", value: "63185946630" },
  { label: "Branch code", value: "250655" },
  { label: "Account type", value: "Gold Business Account" },
  { label: "SWIFT code", value: "FIRNZAJJ" },
] as const;

type PaymentOption = "full" | "deposit";
type PaymentMethod = "proof";

export function BookingScreen({ trip, setView }: { trip: Trip | null; setView: (view: View) => void }) {
  const { formatTripMoney, priceNotice } = useCurrency();
  const { refreshPricingTier, resolveTripPricing } = usePricing();
  const [activeStep, setActiveStep] = useState(0);
  const [travelers, setTravelers] = useState(1);
  const [companionNames, setCompanionNames] = useState<string[]>([]);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");
  const [paymentMethod] = useState<PaymentMethod>("proof");
  const [pickupPoint, setPickupPoint] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");

  const pickupPoints = useMemo(() => {
    if (!trip) return [];
    const points = trip.pickupPoints.length > 0 ? trip.pickupPoints : [trip.meetingPoint].filter(Boolean);
    return points.length > 0 ? points : ["Main university pickup"];
  }, [trip]);

  const selectedPickupPoint = pickupPoint || pickupPoints[0] || "";
  const travelerLimit = Math.max(1, Math.min(trip?.seatsRemaining ?? 1, maxTravelersPerBooking));
  const pricing = useMemo(() => (trip ? resolveTripPricing(trip) : { price: 0, comparePrice: null, deposit: 0, tier: "guest" as const }), [resolveTripPricing, trip]);
  const amountPerTraveler = paymentOption === "deposit" ? pricing.deposit : pricing.price;
  const dueNow = amountPerTraveler * travelers;
  const companionCount = Math.max(travelers - 1, 0);

  const updateTravelers = (value: number) => {
    const nextTravelers = Math.max(1, Math.min(value || 1, travelerLimit));
    setTravelers(nextTravelers);
    setCompanionNames((current) => Array.from({ length: Math.max(nextTravelers - 1, 0) }, (_, index) => current[index] ?? ""));
  };

  const updateCompanionName = (index: number, value: string) => {
    setCompanionNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  const createBookingRef = () => `STSA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const submitBooking = async () => {
    setBookingMessage("");

    if (!supabase || !trip) {
      setBookingMessage("Booking is temporarily unavailable. Please try again shortly.");
      return;
    }

    if (paymentMethod === "proof" && !proofFile) {
      setBookingMessage("Please upload your proof of payment before submitting.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmitting(false);
      setBookingMessage("Please log in to complete your booking.");
      setView("login");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("first_name,last_name,email,phone").eq("id", user.id).maybeSingle();
    const bookingRef = createBookingRef();
    const notes = {
      pickupPoint: selectedPickupPoint,
      referralCode: referralCode.trim() || null,
      companionNames: companionNames.map((name) => name.trim()).filter(Boolean),
      paymentOption,
      paymentMethod,
    };

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        booking_ref: bookingRef,
        user_id: user.id,
        trip_id: trip.id,
        status: "Awaiting Proof",
        traveler_first_name: profile?.first_name ?? user.user_metadata?.first_name ?? null,
        traveler_last_name: profile?.last_name ?? user.user_metadata?.last_name ?? null,
        traveler_email: profile?.email ?? user.email ?? null,
        traveler_phone: profile?.phone ?? user.user_metadata?.phone ?? null,
        total_cents: pricing.price * travelers,
        deposit_cents: pricing.deposit * travelers,
        paid_cents: 0,
        notes: JSON.stringify(notes),
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      setSubmitting(false);
      setBookingMessage(friendlyError(bookingError, "Could not create booking. Please try again."));
      return;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      booking_id: booking.id,
      user_id: user.id,
      amount_cents: dueNow,
      method: "eft",
      status: "Pending",
      provider: "EFT",
      provider_reference: paymentReference.trim() || bookingRef,
    });

    if (paymentError) {
      setSubmitting(false);
      setBookingMessage(friendlyError(paymentError, "Could not record your payment details. Please try again."));
      return;
    }

    if (paymentMethod === "proof" && proofFile) {
      const extension = proofFile.name.split(".").pop()?.toLowerCase() || "proof";
      const filePath = `${user.id}/${booking.id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(proofBucket).upload(filePath, proofFile, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        setSubmitting(false);
        setBookingMessage(friendlyError(uploadError, "Could not upload your proof of payment. Please try again."));
        return;
      }

      const { error: proofError } = await supabase.from("payment_proofs").insert({
        booking_id: booking.id,
        user_id: user.id,
        file_path: filePath,
        file_name: proofFile.name,
        mime_type: proofFile.type,
        amount_cents: dueNow,
      });

      if (proofError) {
        setSubmitting(false);
        setBookingMessage(friendlyError(proofError, "Could not save your proof of payment. Please try again."));
        return;
      }
    }

    setSubmitting(false);
    setBookingMessage("Proof submitted. Your booking is awaiting review.");
    await refreshPricingTier();
    setView("customer");
  };

  if (!trip) {
    return (
      <main className="booking-page">
        <section className="container app-empty-state">
          <h2>No trip selected</h2>
          <p>Choose a trip before starting checkout.</p>
          <button type="button" onClick={() => setView("trips")}>Browse trips</button>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-page">
      <div className="container booking-layout">
        <section className="booking-flow">
          <header className="booking-head card">
            <h1 className="font-display">Secure your trip in 4 quick steps</h1>
            <p>Set travelers, review your booking, copy the bank details, then upload your EFT proof for review.</p>
            <nav className="booking-steps" aria-label="Booking steps">
              {steps.map((step, index) => (
                <button key={step} className={index === activeStep ? "active" : ""} type="button" onClick={() => setActiveStep(index)}>
                  <span>Step {index + 1}</span>
                  <strong>{step}</strong>
                </button>
              ))}
            </nav>
          </header>

          <section className="card booking-panel">
            {activeStep === 0 ? (
              <>
                <h2>1. Traveler setup</h2>
                <label>
                  Select tour
                  <select value={trip.id} disabled>
                    <option>{trip.title} ({trip.city}) - {formatDate(trip.startDate)}</option>
                  </select>
                </label>
                <div className="booking-form-grid">
                  <label>
                    Travelers
                    <input type="number" min="1" max={travelerLimit} value={travelers} onChange={(event) => updateTravelers(Number(event.target.value))} />
                    <small>Maximum 8 travelers per booking: you plus up to 7 additional travelers.</small>
                  </label>
                  <label>
                    Payment option
                    <select value={paymentOption} onChange={(event) => setPaymentOption(event.target.value as PaymentOption)}>
                      <option value="full">Full payment</option>
                      <option value="deposit">Deposit only</option>
                    </select>
                  </label>
                </div>
                <label>
                  Pickup point
                  <select value={selectedPickupPoint} onChange={(event) => setPickupPoint(event.target.value)}>
                    {pickupPoints.map((point) => (
                      <option key={point} value={point}>{point}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Referral code (optional)
                  <input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} placeholder="WELCOMETOO" />
                </label>
                {companionCount > 0 ? (
                  <section className="booking-companions">
                    <div>
                      <strong>Additional traveler names</strong>
                      <span>Lead traveler is your account profile. Add up to 7 more traveler names below.</span>
                    </div>
                    {Array.from({ length: companionCount }).map((_, index) => (
                      <label key={index}>
                        Traveler {index + 2} full name
                        <input value={companionNames[index] ?? ""} onChange={(event) => updateCompanionName(index, event.target.value)} placeholder="Full name as per ID / Passport" />
                      </label>
                    ))}
                  </section>
                ) : null}
                <button className="booking-primary" type="button" onClick={() => setActiveStep(1)}>Review details</button>
              </>
            ) : null}

            {activeStep === 1 ? (
              <>
                <h2>2. Review details</h2>
                <dl className="booking-review-list">
                  <div><dt>Trip</dt><dd>{trip.title}</dd></div>
                  <div><dt>Departure date</dt><dd>{formatDate(trip.startDate)}</dd></div>
                  <div><dt>Travelers</dt><dd>{travelers}</dd></div>
                  {companionCount > 0 ? <div><dt>Additional travelers</dt><dd>{companionNames.map((name) => name.trim()).filter(Boolean).join(", ") || "Names not completed"}</dd></div> : null}
                  <div><dt>Pickup point</dt><dd>{selectedPickupPoint}</dd></div>
                  <div><dt>Payment option</dt><dd>{paymentOption === "deposit" ? "Deposit only" : "Full payment"}</dd></div>
                  <div><dt>Due now</dt><dd>{formatTripMoney(dueNow)}</dd></div>
                </dl>
                <div className="booking-actions">
                  <button type="button" onClick={() => setActiveStep(0)}>Back</button>
                  <button type="button" onClick={() => setActiveStep(2)}>Continue to bank details</button>
                </div>
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
                <h2>3. Banking details</h2>
                <section className="booking-bank-card">
                  <div className="booking-bank-card-top">
                    <div>
                      <span>Transfer destination</span>
                      <strong>FNB business banking</strong>
                    </div>
                    <em>EFT preferred</em>
                  </div>

                  <div className="booking-bank-grid">
                    {bankDetails.map((item) => (
                      <article key={item.label} className="booking-bank-item">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>

                  <div className="booking-bank-reference">
                    <span>Payment reference</span>
                    <strong>{paymentReference.trim() || "Your full name + trip title"}</strong>
                    <small>Use a reference that helps the team match your transfer quickly.</small>
                  </div>
                </section>

                <div className="booking-payment-ready">
                  <div>
                    <strong>Amount to transfer now</strong>
                    <span>{formatTripMoney(dueNow)} for {travelers} traveler{travelers === 1 ? "" : "s"}.</span>
                  </div>
                </div>

                <div className="booking-actions">
                  <button type="button" onClick={() => setActiveStep(1)}>Back</button>
                  <button type="button" onClick={() => setActiveStep(3)}>I have the bank details</button>
                </div>
              </>
            ) : null}

            {activeStep === 3 ? (
              <>
                <h2>4. Payment proof</h2>
                <div className="booking-payment-methods" aria-label="Payment method">
                  <div className="active">
                    <FileUp size={20} />
                    <span>
                      <strong>Upload proof of payment</strong>
                      <small>Pay by EFT and upload your proof for review.</small>
                    </span>
                  </div>
                </div>

                <div className="booking-proof-panel">
                  <div className="booking-bank-details">
                    <strong>EFT payment details</strong>
                    <span>{priceNotice}</span>
                  </div>
                  <label>
                    Payment reference
                    <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Your name + trip title" />
                  </label>
                  <label className="booking-proof-upload">
                    Proof of payment
                    <span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setProofFile(file);
                          setProofFileName(file?.name ?? "");
                        }}
                      />
                      <strong>Choose file</strong>
                      <small>{proofFileName || "PDF, JPG or PNG"}</small>
                    </span>
                  </label>
                </div>

                <div className="booking-actions">
                  <button type="button" onClick={() => setActiveStep(2)}>Back</button>
                  <button type="button" onClick={submitBooking} disabled={submitting}>{submitting ? "Submitting..." : "Submit proof"}</button>
                </div>
                {bookingMessage ? <p className="auth-message">{bookingMessage}</p> : null}
              </>
            ) : null}
          </section>
        </section>

        <aside className="booking-summary card">
          <h2>Tour summary</h2>
          <div className="booking-summary-art">
            {trip.image ? <img src={trip.image} alt={`${trip.title} preview`} /> : null}
            <div />
            <strong>{trip.title}</strong>
          </div>
          <section className="booking-summary-place">
            <strong>{trip.city}</strong>
            <span>{trip.category}</span>
          </section>
          {pricing.comparePrice ? (
            <section className="booking-summary-sale">
              <span>Was {formatTripMoney(pricing.comparePrice)}</span>
              <strong>Now {formatTripMoney(pricing.price)}</strong>
            </section>
          ) : null}
          <div className="booking-summary-meta">
            <span><Users size={17} /> {travelers} traveler{travelers === 1 ? "" : "s"}</span>
            <span><CalendarDays size={17} /> {formatDate(trip.startDate)}</span>
            <span><Clock size={17} /> Pickup: {selectedPickupPoint}</span>
          </div>
          <dl className="booking-summary-totals">
            <div><dt>Price per traveler</dt><dd>{formatTripMoney(pricing.price)}</dd></div>
            <div><dt>Deposit per traveler</dt><dd>{formatTripMoney(pricing.deposit)}</dd></div>
            <div className="due"><dt>Due now</dt><dd>{formatTripMoney(dueNow)}</dd></div>
          </dl>
          <p><CheckCircle2 size={15} /> {priceNotice}</p>
        </aside>
      </div>
    </main>
  );
}
