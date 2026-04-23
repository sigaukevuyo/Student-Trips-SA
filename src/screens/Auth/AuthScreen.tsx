import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { friendlyError } from "../../lib/friendlyError";
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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

function getPasswordIssues(password: string) {
  return [
    password.length >= 8 ? "" : "at least 8 characters",
    /[A-Z]/.test(password) ? "" : "one uppercase letter",
    /[a-z]/.test(password) ? "" : "one lowercase letter",
    /\d/.test(password) ? "" : "one number",
  ].filter(Boolean);
}

function PasswordField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="auth-password-field">
        <input
          required
          autoComplete="new-password"
          minLength={8}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

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
  const [fieldNotice, setFieldNotice] = useState("");
  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const updateField = (field: keyof AuthFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setFieldNotice("");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Account access is temporarily unavailable. Please try again shortly.");
      return;
    }

    setLoading(true);

    const email = form.email.trim();
    const phone = form.phone.trim();

    if ((mode === "login" || mode === "register" || mode === "resetPassword") && !emailPattern.test(email)) {
      setLoading(false);
      setFieldNotice("Please enter a valid email address.");
      return;
    }

    if (mode === "register" && phone && !phonePattern.test(phone)) {
      setLoading(false);
      setFieldNotice("Please enter a valid phone number, for example +27 79 707 5710.");
      return;
    }

    if (mode === "register" || mode === "updatePassword") {
      const passwordIssues = getPasswordIssues(form.password);
      if (passwordIssues.length > 0) {
        setLoading(false);
        setFieldNotice(`Password must include ${passwordIssues.join(", ")}.`);
        return;
      }
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      setLoading(false);

      if (error) {
        setMessage(friendlyError(error, "We could not log you in. Please try again."));
        return;
      }

      const dashboardView = await onLoggedIn();
      setView(dashboardView);
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone,
          },
        },
      });

      setLoading(false);

      if (error) {
        setMessage(friendlyError(error, "We could not create your account. Please try again."));
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
        setMessage(friendlyError(error, "We could not update your password. Please try again."));
        return;
      }

      const dashboardView = await onLoggedIn();
      setMessage("Password updated. You can continue to your dashboard.");
      setView(dashboardView);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      setMessage(friendlyError(error, "We could not send the reset link. Please try again."));
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
              <input required autoComplete="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="name@example.com" />
            </label>
            <label>
              Phone
              <input autoComplete="tel" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+27 79 707 5710" />
              <small>Use a reachable WhatsApp or mobile number.</small>
            </label>
          </div>

          <PasswordField
            label="Password"
            value={form.password}
            onChange={(value) => updateField("password", value)}
            helper="Minimum 8 characters, with uppercase, lowercase, and a number."
          />

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Creating account" /> : "Create Account"}
          </button>
          {fieldNotice ? <p className="auth-message warning">{fieldNotice}</p> : null}
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
            <input required autoComplete="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="name@example.com" />
          </label>

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Sending reset link" /> : "Send reset link"}
          </button>
          {fieldNotice ? <p className="auth-message warning">{fieldNotice}</p> : null}
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

          <PasswordField
            label="New Password"
            value={form.password}
            onChange={(value) => updateField("password", value)}
            helper="Minimum 8 characters, with uppercase, lowercase, and a number."
          />

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? <ThemeLoader label="Updating password" /> : "Update password"}
          </button>
          {fieldNotice ? <p className="auth-message warning">{fieldNotice}</p> : null}
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
          <input required autoComplete="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="name@example.com" />
        </label>

        <PasswordField label="Password" value={form.password} onChange={(value) => updateField("password", value)} />

        <button className="auth-forgot" type="button" onClick={() => setView("resetPassword")}>
          Forgot password?
        </button>

        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? <ThemeLoader label="Logging in" /> : "Log In"}
        </button>
        {fieldNotice ? <p className="auth-message warning">{fieldNotice}</p> : null}
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
