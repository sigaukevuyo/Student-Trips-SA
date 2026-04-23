import type { Trip } from "../../lib/types";

export function StatusBadge({ status }: { status: Trip["status"] | string }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-").replaceAll("_", "-");

  return <span className={`status status-${statusClass}`}>{status.replaceAll("_", " ")}</span>;
}
