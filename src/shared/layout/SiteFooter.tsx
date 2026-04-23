import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

import type { View } from "../navigation";

function PaymentBadge({ label, mark }: { label: string; mark: string }) {
  return (
    <span className="footer-payment-badge">
      <small>{mark}</small>
      {label}
    </span>
  );
}

function MastercardBadge() {
  return (
    <span className="footer-payment-badge footer-payment-badge-mastercard" aria-label="Mastercard">
      <svg aria-hidden="true" viewBox="0 0 38 28" width="38" height="28">
        <rect width="38" height="28" rx="6" fill="#fff" />
        <circle cx="15.5" cy="14" r="6.5" fill="#EB001B" />
        <circle cx="22.5" cy="14" r="6.5" fill="#F79E1B" />
        <path fill="#FF5F00" d="M19 8.4a8 8 0 0 0 0 11.2 8 8 0 0 0 0-11.2Z" />
      </svg>
    </span>
  );
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function SiteFooter({
  activeView,
  onCityClick,
  setView,
}: {
  activeView: View;
  onCityClick: (cityName: string) => void;
  setView: (view: View) => void;
}) {
  const hideCta = activeView === "customer" || activeView === "admin" || activeView === "branch";

  return (
    <>
      {!hideCta ? (
        <section className="container footer-cta">
          <div>
            <span>Student Trips SA</span>
            <h2 className="font-display">Ready for your next city escape?</h2>
            <p>Browse departures, choose full or deposit payment, and lock in your trip in minutes.</p>
          </div>
          <div>
            <button type="button" onClick={() => setView("trips")}>
              Explore Trips
            </button>
            <button type="button" onClick={() => setView("cities")}>
              Browse Cities
            </button>
          </div>
        </section>
      ) : null}

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <button className="footer-logo-wrap" onClick={() => setView("home")} type="button">
                <img src="/assets/LOGO.png" alt="Student Trips SA" />
              </button>
              <p>Youthful and trusted travel experiences built for students and young adults across South Africa.</p>
              <div className="footer-payments">
                <strong>Card Payments</strong>
                <PaymentBadge mark="VISA" label="" />
                <MastercardBadge />
              </div>
            </div>

            <nav className="footer-column" aria-label="Quick links">
              <strong>Quick Links</strong>
              <button type="button" onClick={() => setView("trips")}>
                Trips
              </button>
              <button type="button" onClick={() => setView("cities")}>
                Cities
              </button>
              <button type="button" onClick={() => setView("faq")}>
                FAQ
              </button>
              <button type="button" onClick={() => setView("partner")}>
                Partners
              </button>
              <button type="button" onClick={() => setView("contact")}>
                Contact
              </button>
            </nav>

            <nav className="footer-column" aria-label="Cities">
              <strong>Cities</strong>
              <button type="button" onClick={() => onCityClick("Johannesburg")}>Johannesburg</button>
              <button type="button" onClick={() => onCityClick("Cape Town")}>Cape Town</button>
              <button type="button" onClick={() => onCityClick("Pretoria")}>Pretoria</button>
              <button type="button" onClick={() => onCityClick("Durban")}>Durban</button>
              <button type="button" onClick={() => onCityClick("Gqeberha")}>Gqeberha</button>
            </nav>

            <div className="footer-column footer-support">
              <strong>Support</strong>
              <a href="mailto:hello@studenttrips.co.za">
                <Mail size={17} />
                hello@studenttrips.co.za
              </a>
              <a href="tel:+27797075710">
                <Phone size={17} />
                +27 79 707 5710
              </a>
              <span>
                <MapPin size={17} />
                South Africa city support network
              </span>

              <strong className="footer-social-title">Social</strong>
              <div className="footer-socials">
                <a href="https://www.instagram.com/studenttripssa" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
                <a href="https://web.facebook.com/studenttripssa?_rdc=1&_rdr#" target="_blank" rel="noreferrer" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
                <a href="https://www.tiktok.com/@studenttripssa" target="_blank" rel="noreferrer" aria-label="TikTok">
                  <TikTokIcon size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="footer-divider" />

          <div className="footer-bottom">
            <div>
              <p>(c) 2026 Student Trips SA. All rights reserved.</p>
              <p className="footer-credit-line">
                Designed by{" "}
                <a className="footer-credit-link" href="https://hadiniholdings.co.za" target="_blank" rel="noreferrer">
                  Hadini Holdings
                </a>
              </p>
            </div>

            <div className="footer-bottom-right">
              <nav className="footer-legal" aria-label="Legal links">
                <button type="button" onClick={() => setView("terms")}>
                  Terms
                </button>
                <button type="button" onClick={() => setView("privacy")}>
                  Privacy
                </button>
                <button type="button" onClick={() => setView("refund")}>
                  Refund Policy
                </button>
                <button type="button" onClick={() => setView("accessibility")}>
                  Accessibility Statement
                </button>
                <button type="button" onClick={() => setView("waiver")}>
                  Waiver Policy
                </button>
              </nav>
              <p className="footer-brand-note">Student Trips SA is proudly part of The Yebogo SA (Pty) Ltd portfolio of brands</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
