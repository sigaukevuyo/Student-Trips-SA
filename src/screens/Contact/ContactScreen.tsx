import "./ContactScreen.css";

export function ContactScreen() {
  return (
    <main className="contact-page">
      <section className="container contact-shell" aria-labelledby="contact-title">
        <div className="contact-intro">
          <h1 className="font-display" id="contact-title">
            Contact Us
          </h1>
          <p>Reach Student Trips SA for booking support, city inquiries, or partnership opportunities.</p>

          <div className="contact-note">
            Email:{" "}
            <a href="mailto:hello@studenttrips.co.za">hello@studenttrips.co.za</a>
            <span>|</span>
            WhatsApp:{" "}
            <a href="tel:+27797075710">+27 79 707 5710</a>
            <span>|</span>
            City support across JHB, CPT, PTA, DBN, and PE
          </div>
        </div>

        <article className="contact-hours-card">
          <h2 className="font-display">Support Hours</h2>
          <div className="contact-hours-list">
            <p>Monday to Friday: 08:30 - 18:00</p>
            <p>Saturday: 09:00 - 14:00</p>
            <p>Sunday: Closed</p>
          </div>

          <div className="contact-support-list">
            <p>
              Support Email: <a href="mailto:hello@studenttrips.co.za">hello@studenttrips.co.za</a>
            </p>
            <p>
              Support Phone: <a href="tel:+27797075710">+27 79 707 5710</a>
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
