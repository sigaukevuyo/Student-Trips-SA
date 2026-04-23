import { CalendarDays, CheckCircle2, Clock, CreditCard, FileUp, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { formatDate, formatMoney } from "../../lib/data";
import { supabase } from "../../lib/supabase";
import type { Trip } from "../../lib/types";
import type { View } from "../../shared/navigation";
import "./BookingScreen.css";

const steps = ["Traveler setup", "Review details", "Payment"];
const proofBucket = "payment-proofs";

type PaymentOption = "full" | "deposit";
type PaymentMethod = "card" | "proof";

export function BookingScreen({ trip, setView }: { trip: Trip | null; setView: (view: View) => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [travelers, setTravelers] = useState(1);
  const [companionNames, setCompanionNames] = useState<string[]>([]);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
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
    return points.length > 0 ? points : ["Main campus pickup"];
  }, [trip]);

  const selectedPickupPoint = pickupPoint || pickupPoints[0] || "";
  const amountPerTraveler = paymentOption === "deposit" ? trip?.deposit ?? 0 : trip?.price ?? 0;
  const dueNow = amountPerTraveler * travelers;
  const companionCount = Math.max(travelers - 1, 0);

  const updateTravelers = (value: number) => {
    const nextTravelers = Math.max(1, Math.min(value || 1, Math.max(trip?.seatsRemaining ?? 1, 1)));
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
        status: paymentMethod === "proof" ? "Awaiting Proof" : "Pending Payment",
        traveler_first_name: profile?.first_name ?? user.user_metadata?.first_name ?? null,
        traveler_last_name: profile?.last_name ?? user.user_metadata?.last_name ?? null,
        traveler_email: profile?.email ?? user.email ?? null,
        traveler_phone: profile?.phone ?? user.user_metadata?.phone ?? null,
        total_cents: trip.price * travelers,
        deposit_cents: trip.deposit * travelers,
        paid_cents: 0,
        notes: JSON.stringify(notes),
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      setSubmitting(false);
      setBookingMessage(bookingError?.message ?? "Could not create booking. Please try again.");
      return;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      booking_id: booking.id,
      user_id: user.id,
      amount_cents: dueNow,
      method: paymentMethod === "proof" ? "eft" : "card",
      status: "Pending",
      provider: paymentMethod === "proof" ? "EFT" : "Card",
      provider_reference: paymentReference.trim() || bookingRef,
    });

    if (paymentError) {
      setSubmitting(false);
      setBookingMessage(paymentError.message);
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
        setBookingMessage(uploadError.message);
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
        setBookingMessage(proofError.message);
        return;
      }
    }

    setSubmitting(false);
    setBookingMessage(paymentMethod === "proof" ? "Proof submitted. Your booking is awaiting review." : "Booking created. Continue with card payment to confirm your seat.");
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
            <h1 className="font-display">Secure your trip in 3 quick steps</h1>
            <p>Set travelers, choose pickup, review your details, then continue to secure checkout.</p>
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
                    <input type="number" min="1" max={Math.max(trip.seatsRemaining, 1)} value={travelers} onChange={(event) => updateTravelers(Number(event.target.value))} />
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
                      <span>Lead traveler is your account profile. Add the other traveler names below.</span>
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
                  <div><dt>Due now</dt><dd>{formatMoney(dueNow)}</dd></div>
                </dl>
                <div className="booking-actions">
                  <button type="button" onClick={() => setActiveStep(0)}>Back</button>
                  <button type="button" onClick={() => setActiveStep(2)}>Continue to payment</button>
                </div>
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
                <h2>3. Payment</h2>
                <div className="booking-payment-methods" role="radiogroup" aria-label="Payment method">
                  <button className={paymentMethod === "card" ? "active" : ""} type="button" onClick={() => setPaymentMethod("card")}>
                    <CreditCard size={20} />
                    <span>
                      <strong>Pay immediately by card</strong>
                      <small>Use secure card payment for instant confirmation.</small>
                    </span>
                  </button>
                  <button className={paymentMethod === "proof" ? "active" : ""} type="button" onClick={() => setPaymentMethod("proof")}>
                    <FileUp size={20} />
                    <span>
                      <strong>Upload proof of payment</strong>
                      <small>Pay by EFT and upload your proof for review.</small>
                    </span>
                  </button>
                </div>

                {paymentMethod === "card" ? (
                  <div className="booking-payment-ready">
                    <CreditCard size={22} />
                    <div>
                      <strong>{formatMoney(dueNow)} due now</strong>
                      <span>Continue to secure card checkout to complete your booking.</span>
                    </div>
                  </div>
                ) : (
                  <div className="booking-proof-panel">
                    <div className="booking-bank-details">
                      <strong>EFT payment details</strong>
                      <span>Use your name and trip title as the payment reference.</span>
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
                )}

                <div className="booking-actions">
                  <button type="button" onClick={() => setActiveStep(1)}>Back</button>
                  <button type="button" onClick={submitBooking} disabled={submitting}>{submitting ? "Submitting..." : paymentMethod === "card" ? "Pay by card" : "Submit proof"}</button>
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
          <div className="booking-summary-meta">
            <span><Users size={17} /> {travelers} traveler{travelers === 1 ? "" : "s"}</span>
            <span><CalendarDays size={17} /> {formatDate(trip.startDate)}</span>
            <span><Clock size={17} /> Pickup: {selectedPickupPoint}</span>
          </div>
          <dl className="booking-summary-totals">
            <div><dt>Price per traveler</dt><dd>{formatMoney(trip.price)}</dd></div>
            <div><dt>Deposit per traveler</dt><dd>{formatMoney(trip.deposit)}</dd></div>
            <div className="due"><dt>Due now</dt><dd>{formatMoney(dueNow)}</dd></div>
          </dl>
          <p><CheckCircle2 size={15} /> Summary updates as you change travelers, pickup, and payment mode.</p>
        </aside>
      </div>
    </main>
  );
}
