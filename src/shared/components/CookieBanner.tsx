import { useEffect, useState } from "react";

const cookieConsentKey = "student-trips:cookie-consent";

type CookieConsent = "accepted" | "declined";

function getSavedCookieConsent(): CookieConsent | null {
  try {
    const savedValue = window.localStorage.getItem(cookieConsentKey);
    return savedValue === "accepted" || savedValue === "declined" ? savedValue : null;
  } catch {
    return null;
  }
}

export function CookieBanner({ onPrivacyClick }: { onPrivacyClick: () => void }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    setConsent(getSavedCookieConsent());
  }, []);

  function saveConsent(nextConsent: CookieConsent) {
    try {
      window.localStorage.setItem(cookieConsentKey, nextConsent);
    } catch {
      // Ignore storage failures and let the banner close for this session.
    }

    setConsent(nextConsent);
  }

  if (consent) return null;

  return (
    <aside className="cookie-banner" aria-label="Cookie consent">
      <div className="cookie-banner-copy">
        <strong>This website uses cookies</strong>
        <p>We use cookies and similar storage for login, preferences, and core site features. You can accept cookies or decline optional cookies.</p>
      </div>
      <div className="cookie-banner-actions">
        <button type="button" className="cookie-link-button" onClick={onPrivacyClick}>Privacy Policy</button>
        <button type="button" className="cookie-secondary-button" onClick={() => saveConsent("declined")}>Decline</button>
        <button type="button" className="cookie-primary-button" onClick={() => saveConsent("accepted")}>Accept Cookies</button>
      </div>
    </aside>
  );
}
