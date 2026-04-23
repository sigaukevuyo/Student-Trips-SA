import { useEffect, useState } from "react";

import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import type { View } from "../../shared/navigation";
import "./OnboardingScreen.css";

type OnboardingFormState = {
  dateOfBirth: string;
  gender: string;
  idPassportNumber: string;
  studentNumber: string;
  campus: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dietaryRequirements: string;
  medicalNotes: string;
};

const initialForm: OnboardingFormState = {
  dateOfBirth: "",
  gender: "",
  idPassportNumber: "",
  studentNumber: "",
  campus: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  dietaryRequirements: "",
  medicalNotes: "",
};

const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

type ProfileRow = {
  date_of_birth: string | null;
  gender: string | null;
  id_passport_number: string | null;
  student_number: string | null;
  campus: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  dietary_requirements: string | null;
  medical_notes: string | null;
  profile_complete_percent: number | null;
};

export function OnboardingScreen({ setView }: { setView: (view: View) => void }) {
  const [form, setForm] = useState<OnboardingFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      setMessage("");

      if (!supabase) {
        setMessage("Profile updates are temporarily unavailable. Please try again shortly.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        setMessage("Log in to complete onboarding.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("date_of_birth,gender,id_passport_number,student_number,campus,emergency_contact_name,emergency_contact_phone,dietary_requirements,medical_notes,profile_complete_percent")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setMessage(friendlyError(error, "We could not load your profile right now. Please try again."));
      }

      const profile = data as ProfileRow | null;
      if (profile) {
        setForm({
          dateOfBirth: profile.date_of_birth ?? "",
          gender: profile.gender ?? "",
          idPassportNumber: profile.id_passport_number ?? "",
          studentNumber: profile.student_number ?? "",
          campus: profile.campus ?? "",
          emergencyContactName: profile.emergency_contact_name ?? "",
          emergencyContactPhone: profile.emergency_contact_phone ?? "",
          dietaryRequirements: profile.dietary_requirements ?? "",
          medicalNotes: profile.medical_notes ?? "",
        });
        setIsEditingProfile((profile.profile_complete_percent ?? 0) >= 100);
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (field: keyof OnboardingFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Profile updates are temporarily unavailable. Please try again shortly.");
      return;
    }

    if (!phonePattern.test(form.emergencyContactPhone.trim())) {
      setMessage("Please enter a valid emergency contact phone number, for example +27 82 999 002.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      setMessage("Log in to complete onboarding.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        date_of_birth: form.dateOfBirth || null,
        gender: form.gender.trim() || null,
        id_passport_number: form.idPassportNumber.trim() || null,
        student_number: form.studentNumber.trim() || null,
        campus: form.campus.trim() || null,
        emergency_contact_name: form.emergencyContactName.trim() || null,
        emergency_contact_phone: form.emergencyContactPhone.trim() || null,
        dietary_requirements: form.dietaryRequirements.trim() || null,
        medical_notes: form.medicalNotes.trim() || null,
        profile_complete_percent: 100,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setMessage(friendlyError(error, "We could not save your profile right now. Please try again."));
      return;
    }

    setView("customer");
  };

  const handleCancel = () => {
    setView("customer");
  };

  return (
    <main className="onboarding-page">
      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="onboarding-head">
          <span className="eyebrow dark">{isEditingProfile ? "Profile" : "Onboarding"}</span>
          <h1 className="font-display">{isEditingProfile ? "Edit traveler profile" : "Complete your traveler profile"}</h1>
          <p>{isEditingProfile ? "Update the details used for trip check-in, university lists, and emergency support." : "These details help the team verify your identity, prepare university pickup lists, and support you during a trip."}</p>
        </div>

        {loading ? (
          <section className="onboarding-loading">
            <ThemeLoader label="Loading onboarding" />
            <p>Loading your profile...</p>
          </section>
        ) : (
          <>
            <section className="onboarding-section">
              <h2>Traveler identity</h2>
              <div className="onboarding-grid">
                <label>
                  Date of Birth
                  <input required type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} />
                </label>
                <label>
                  Gender
                  <select required value={form.gender} onChange={(event) => updateField("gender", event.target.value)}>
                    <option value="">Select gender</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </label>
                <label>
                  ID / Passport Number
                  <input required value={form.idPassportNumber} onChange={(event) => updateField("idPassportNumber", event.target.value)} />
                </label>
                <label>
                  Student Number
                  <input value={form.studentNumber} onChange={(event) => updateField("studentNumber", event.target.value)} placeholder="STD-1001 or N/A" />
                  <small>Optional. Type N/A if not applicable.</small>
                </label>
              </div>
            </section>

            <section className="onboarding-section">
              <h2>University & emergency contact</h2>
              <div className="onboarding-grid">
                <label>
                  University Name
                  <input value={form.campus} onChange={(event) => updateField("campus", event.target.value)} placeholder="UCT or N/A" />
                  <small>Optional. Type N/A if not applicable.</small>
                </label>
                <label>
                  Emergency Contact Name
                  <input required value={form.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} placeholder="Sipho Smit" />
                </label>
              </div>
              <label>
                Emergency Contact Phone
                <input required type="tel" value={form.emergencyContactPhone} onChange={(event) => updateField("emergencyContactPhone", event.target.value)} placeholder="+27 82 999 002" />
                <small>Use a valid phone number with country code where possible.</small>
              </label>
            </section>

            <section className="onboarding-section">
              <h2>Travel preferences</h2>
              <label>
                Dietary Requirements
                <textarea value={form.dietaryRequirements} onChange={(event) => updateField("dietaryRequirements", event.target.value)} />
              </label>
              <label>
                Medical Notes
                <textarea value={form.medicalNotes} onChange={(event) => updateField("medicalNotes", event.target.value)} />
              </label>
            </section>

            <div className={isEditingProfile ? "onboarding-actions split" : "onboarding-actions"}>
              {isEditingProfile ? (
                <button className="onboarding-cancel" disabled={saving} type="button" onClick={handleCancel}>
                  Cancel
                </button>
              ) : null}
              <button className="auth-submit" disabled={saving} type="submit">
                {saving ? <ThemeLoader label="Saving profile" /> : isEditingProfile ? "Update Profile" : "Complete Onboarding"}
              </button>
              {message ? <p className="auth-message">{message}</p> : null}
            </div>
          </>
        )}
      </form>
    </main>
  );
}
