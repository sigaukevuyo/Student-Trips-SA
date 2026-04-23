import { Facebook, Instagram, Mail, MapPin, Music2, Phone } from "lucide-react";

import type { View } from "../navigation";

function PaymentBadge({ label, mark }: { label: string; mark: string }) {
  return (
    <span className="footer-payment-badge">
      <small>{mark}</small>
      {label}
    </span>
  );
}

export function SiteFooter({ activeView, setView }: { activeView: View; setView: (view: View) => void }) {
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
              <button type="button">Johannesburg</button>
              <button type="button">Cape Town</button>
              <button type="button">Pretoria</button>
              <button type="button">Durban</button>
              <button type="button">Gqeberha</button>
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
                  <Music2 size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="footer-divider" />

          <div className="footer-bottom">
            <div>
              <p>(c) 2026 Student Trips SA. All rights reserved.</p>
              <div className="footer-payments">
                <strong>Card Payments</strong>
                <PaymentBadge mark="VISA" label="" />
                <PaymentBadge mark="MC" label="Mastercard" />
              </div>
            </div>

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
          </div>
        </div>
      </footer>
    </>
  );
}
