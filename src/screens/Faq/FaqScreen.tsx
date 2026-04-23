import { Clock3, CreditCard, HelpCircle, Mail, MessageCircle, ShieldCheck, TicketCheck, Undo2 } from "lucide-react";

import "./FaqScreen.css";

const faqs = [
  {
    category: "Bookings",
    question: "What if trip is full?",
    answer: "You can join waitlist and be notified.",
    icon: TicketCheck,
  },
  {
    category: "Payments",
    question: "Can I pay deposit first?",
    answer: "Yes, deposit payment is supported.",
    icon: CreditCard,
  },
  {
    category: "Refunds",
    question: "How are refunds handled?",
    answer: "Admin reviews cancellation and processes approved refunds.",
    icon: Undo2,
  },
  {
    category: "Safety",
    question: "Is waiver mandatory?",
    answer: "Yes, waiver and consent are required.",
    icon: ShieldCheck,
  },
];

const guideSteps = ["Choose a departure", "Reserve with deposit", "Upload details", "Meet your city crew"];

export function FaqScreen() {
  return (
    <main className="faq-page">
      <section className="container faq-shell" aria-labelledby="faq-title">
        <div className="faq-hero">
          <div className="faq-head">
            <span className="faq-kicker">Student trip help desk</span>
            <h1 className="font-display" id="faq-title">
              Frequently Asked Questions
            </h1>
            <p>Everything students and guardians usually ask before booking, paying, joining a waitlist, or getting ready for departure.</p>
          </div>

          <div className="faq-support-card">
            <HelpCircle size={24} />
            <h2 className="font-display">Need a human?</h2>
            <p>Send us your trip name, city, and booking reference if you already have one.</p>
            <div>
              <a href="mailto:hello@studenttrips.co.za">
                <Mail size={16} />
                Email support
              </a>
              <a href="https://wa.me/27797075710" target="_blank" rel="noreferrer">
                <MessageCircle size={16} />
                WhatsApp us
              </a>
            </div>
          </div>
        </div>

        <div className="faq-trust-row" aria-label="Support highlights">
          <span>
            <Clock3 size={17} />
            Same-day replies during support hours
          </span>
          <span>
            <CreditCard size={17} />
            Deposit-first options on eligible trips
          </span>
          <span>
            <ShieldCheck size={17} />
            Waiver and consent checks before departure
          </span>
        </div>

        <div className="faq-flow" aria-label="Booking flow">
          {guideSteps.map((step, index) => (
            <span key={step}>
              <strong>{index + 1}</strong>
              {step}
            </span>
          ))}
        </div>

        <div className="faq-grid">
          {faqs.map((item, index) => {
            const Icon = item.icon;

            return (
              <details className="faq-card" key={item.question} open={index === 0}>
                <summary>
                  <span className="faq-card-icon">
                    <Icon size={19} />
                  </span>
                  <span>
                    <small>{item.category}</small>
                    <strong className="font-display">{item.question}</strong>
                  </span>
                </summary>
                <p>{item.answer}</p>
              </details>
            );
          })}
        </div>
      </section>
    </main>
  );
}
