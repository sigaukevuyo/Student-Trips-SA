import type { View } from "../../shared/navigation";
import "./PolicyScreen.css";

type PolicyView = Extract<View, "terms" | "privacy" | "refund" | "accessibility" | "waiver">;

type PolicyContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: {
    heading?: string;
    paragraphs?: string[];
    list?: string[];
  }[];
};

const policies: Record<PolicyView, PolicyContent> = {
  terms: {
    eyebrow: "Legal",
    title: "Terms & Conditions",
    intro: "By booking with Student Trips SA, you agree to payment timelines, conduct policies, and safety instructions.",
    sections: [
      {
        paragraphs: [
          "Trip itineraries may be adjusted for weather, safety, or supplier constraints with reasonable notice.",
          "Bookings are subject to capacity limits, waitlist rules, and city-specific operational decisions.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro: "We collect booking and profile data needed to manage trips, safety requirements, and payment records.",
    sections: [
      {
        paragraphs: [
          "Personal data is handled by authorized operational staff and role-based dashboards only.",
          "For local development, files and proofs are stored locally; production storage should be configured securely.",
        ],
      },
    ],
  },
  refund: {
    eyebrow: "Bookings",
    title: "Refund & Cancellation Policy",
    intro: "Cancellation requests are submitted from customer bookings and reviewed by admin before approval.",
    sections: [
      {
        paragraphs: [
          "Approved refunds are reflected as Refund Pending and then Refunded once processed.",
          "Timing and eligibility depend on trip departure dates and supplier commitments.",
        ],
      },
    ],
  },
  accessibility: {
    eyebrow: "Access",
    title: "Accessibility Statement",
    intro:
      "At Student Trips SA, we want our website to be easy to use for everyone. We are committed to creating a digital experience that is inclusive, clear, and accessible to all users, including people with disabilities.",
    sections: [
      {
        paragraphs: [
          "Whether you are browsing trips, checking details, sending an enquiry, or making a booking, our goal is to make the experience as smooth as possible across desktop and mobile.",
        ],
      },
      {
        heading: "What we are working on",
        list: [
          "Clear, easy-to-read content.",
          "Simple and consistent navigation.",
          "Readable buttons and links.",
          "Better colour contrast and visibility.",
          "Mobile-friendly browsing.",
          "Easier-to-use forms and clearer error messages.",
        ],
      },
      {
        heading: "Ongoing improvement",
        paragraphs: ["Accessibility is not a once-off task. We regularly review and improve our website so it becomes easier for more people to use over time."],
      },
      {
        heading: "Need support?",
        paragraphs: [
          "If you experience any difficulty using our website, accessing trip information, or completing an enquiry or booking, please contact us and we will do our best to help.",
          "Email: support@studenttrips.co.za",
          "Phone/WhatsApp: +27 79 707 5710",
        ],
      },
    ],
  },
  waiver: {
    eyebrow: "Safety",
    title: "Waiver Policy",
    intro: "All travelers must accept the latest waiver version before booking confirmation.",
    sections: [
      {
        paragraphs: [
          "Waiver acceptance captures consent, timestamp, and booking linkage for operational records.",
          "This page is a policy placeholder for MVP and can be replaced with legal final copy.",
        ],
      },
    ],
  },
};

export function PolicyScreen({ policy }: { policy: PolicyView }) {
  const content = policies[policy];

  return (
    <main className="policy-page">
      <section className="container policy-shell" aria-labelledby="policy-title">
        <span className="policy-eyebrow">{content.eyebrow}</span>
        <h1 className="font-display" id="policy-title">
          {content.title}
        </h1>
        <p className="policy-intro">{content.intro}</p>

        <div className="policy-card">
          {content.sections.map((section, index) => (
            <section className="policy-section" key={`${section.heading ?? content.title}-${index}`}>
              {section.heading ? <h2 className="font-display">{section.heading}</h2> : null}
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.list ? (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
