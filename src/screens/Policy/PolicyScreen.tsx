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
        list: [
          "Trip itineraries may be adjusted for weather, safety, or supplier constraints with reasonable notice.",
          "Bookings are subject to capacity limits, waitlist rules, and city-specific operational decisions.",
          "Participants must meet minimum age requirements for each trip. The minimum age is stated in the trip description.",
          "Minors under 18 must provide signed parental or guardian consent.",
          "Adults are responsible for themselves, and guardians are responsible for minors.",
          " Provide accurate personal, medical, and emergency contact information.",
          "Follow all instructions from staff and activity providers. Misbehavior may lead to removal from the Trip without refund.",
          "Comply with the rules of all accommodations, transport providers, and activity venues.",
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
        list: [
          "We collect personal information for bookings, communication, and trip management.",
          "Data is handled in compliance with POPIA.",
          "Personal information will not be shared except as required for service provision or by law.",
          "Data is retained only as necessary for administrative purposes.",
        ],
      },
    ],
  },
  refund: {
    eyebrow: "Bookings",
    title: "Refund & Cancellation Policy",
    intro: "We understand that sometimes plans may change. To protect both our travelers and our operational costs, the following refund terms apply to all bookings.",
    sections: [
      {
        heading: "1. Deposits",
        list: [
          "All deposits are non-refundable, regardless of when you cancel.",
          "Deposits secure your spot and cover upfront administrative and reservation costs.",
        ],
      },
      {
        heading: "2. Cancellation & Refund Schedule",
        list: [
          "28 days or more before departure: You are eligible for a 70% refund of the total trip price, excluding the deposit.",
          "23-27 days before departure: You are eligible for a 50% refund of the total trip price, excluding the deposit.",
          "15-22 days before departure: You are eligible for a 25% refund of the total trip price, excluding the deposit.",
          "14 days or less before departure, or no-show: No refund will be issued.",
          "In all cases, travelers may transfer their booking to another person up to 7 days before departure, subject to approval and an administrative fee.",
        ],
      },
      {
        heading: "3. No-Shows",
        list: [
          "If you do not arrive for the trip, you will not be entitled to any refund, regardless of circumstances.",
        ],
      },
      {
        heading: "4. Special Circumstances",
        list: [
          "Refunds outside of the schedule above are not guaranteed and are solely at the discretion of Student Trips SA.",
          "Medical exceptions: proof of medical emergency may allow discretionary refunds.",
          "Trip postponement or substitutions: participants may reschedule before final payment, subject to availability.",
          "Participants may nominate a substitute, subject to approval.",
          "Cancellations by Student Trips SA: trips may be canceled due to low bookings, weather, or unforeseen circumstances. Participants will receive a full refund or an alternative trip.",
          "Student Trips SA is not liable for additional costs incurred by participants, such as travel to the departure point.",
          "Booking fees, optional extras, or deposits paid to third-party providers are non-refundable.",
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
