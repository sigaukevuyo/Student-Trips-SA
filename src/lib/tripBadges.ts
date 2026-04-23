import type { Trip } from "./types";

export function getTripBadges(trip: Pick<Trip, "featured" | "tags" | "isSpecial">) {
  const labels = [
    ...(trip.isSpecial ? ["Special"] : []),
    ...(trip.featured ? ["Featured"] : []),
    ...trip.tags,
  ];
  const seen = new Set<string>();

  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label) => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
