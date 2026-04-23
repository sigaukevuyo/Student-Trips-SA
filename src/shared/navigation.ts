export type View =
  | "home"
  | "trips"
  | "tripDetail"
  | "booking"
  | "cities"
  | "cityDetail"
  | "faq"
  | "updates"
  | "partner"
  | "contact"
  | "login"
  | "register"
  | "onboarding"
  | "resetPassword"
  | "updatePassword"
  | "terms"
  | "privacy"
  | "refund"
  | "accessibility"
  | "waiver"
  | "customer"
  | "admin"
  | "branch";

export const navItems: { label: string; view?: View }[] = [
  { label: "Trips", view: "trips" },
  { label: "Cities", view: "cities" },
  { label: "FAQ", view: "faq" },
  { label: "Updates", view: "updates" },
  { label: "Partners", view: "partner" },
  { label: "Contact", view: "contact" },
];
