import { useState } from "react";

import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import type { View } from "../../shared/navigation";
import "./AuthScreen.css";

type AuthMode = "login" | "register" | "resetPassword" | "updatePassword";

type AuthFormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

const initialForm: AuthFormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
};

export function AuthScreen({
  mode,
  onLoggedIn,
  setView,
}: {
  mode: AuthMode;
  onLoggedIn: () => Promise<View>;
  setView: (view: View) => void;
}) {
  const [form, setForm] = useState<AuthFormState>(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const updateField = (field: keyof AuthFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Account access is temporarily unavailable. Please try again shortly.");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      const dashboardView = await onLoggedIn();
      setView(dashboardView);
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone: form.phone.trim(),
          },
        },
      });

      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        const dashboardView = await onLoggedIn();
        setView(dashboardView);
        return;
      }

      setMessage("Account created. Check your email to confirm your account, then log in.");
      return;
    }

    if (mode === "updatePassword") {
      const { error } = await supabase.auth.updateUser({
        password: form.password,
      });

      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      const dashboardView = await onLoggedIn();
      setMessage("Password updated. You can continue to your dashboard.");
      setView(dashboardView);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Reset link sent. Check your inbox.");
  };

  if (mode === "register") {
    return (
      <main className="auth-page">
        <form className="auth-card auth-card-wide" onSubmit={handleSubmit}>
          <h1 className="font-display">Create Your Travel Account</h1>
          <p>Set up your Student Trips SA account to browse tours, save favorites, and book faster.</p>

          <div className="auth-note">For smooth check-in and traveler verification, please enter your names exactly as they appear on your ID or Passport.</div>

          <div className="auth-grid">
            <label>
              First Name
              <input value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="First name as per ID / Passport" />
              <small>First name as per ID / Passport</small>
            </label>
            <label>
              Last Name
              <input value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="Last name as per ID / Passport" />
              <small>Last name as per ID / Passport</small>
            </label>
          </div>

          <div className="auth-grid">
            <label>
              Email
              <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>
          </div>

          <label>
            Password
            <input required minLength={8} type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} />
            <small>Minimum 8 characters, including uppercase and a number.</small>
          </label>

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Creating account" /> : "Create Account"}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={() => setView("login")}>
              Log in
            </button>
          </p>
        </form>
      </main>
    );
  }

  if (mode === "resetPassword") {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="font-display">Reset Password</h1>
          <p>Enter your account email and we will send a secure reset link.</p>

          <label>
            Email
            <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          </label>

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Sending reset link" /> : "Send reset link"}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
          <p className="auth-switch">
            Remembered your password?{" "}
            <button type="button" onClick={() => setView("login")}>
              Log in
            </button>
          </p>
        </form>
      </main>
    );
  }

  if (mode === "updatePassword") {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="font-display">Set New Password</h1>
          <p>Create a new password for your Student Trips SA account.</p>

          <label>
            New Password
            <input required minLength={8} type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} />
            <small>Minimum 8 characters, including uppercase and a number.</small>
          </label>

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Updating password" /> : "Update password"}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="font-display">Log In</h1>
        <p>It is essential that every adventurer creates and completes an account before travel.</p>

        <label>
          Email
          <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
        </label>

        <label>
          Password
          <input required type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} />
        </label>

        <button className="auth-forgot" type="button" onClick={() => setView("resetPassword")}>
          Forgot password?
        </button>

        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? <ThemeLoader label="Logging in" /> : "Log In"}
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
        <p className="auth-switch">
          No account yet?{" "}
          <button type="button" onClick={() => setView("register")}>
            Create one
          </button>
        </p>
      </form>
    </main>
  );
}
