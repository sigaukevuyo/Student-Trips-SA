import { Button } from "../components/Button";

export function RoleShell({
  title,
  subtitle,
  scope,
  tabs,
  activeTab,
  onTabChange,
  userName,
  userRole,
  children,
}: {
  title?: string;
  subtitle?: string;
  scope: "admin" | "branch";
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}) {
  const items = tabs ?? (scope === "admin"
      ? ["Overview", "Bookings", "Users", "Cities", "Trips", "Payments", "Inquiries", "Updates", "Reviews"]
      : ["Overview", "Trips", "Bookings", "Customers", "Payments", "Media", "Messages", "Reports"]);

  return (
    <main className="ops-shell">
      <aside className="ops-sidebar">
        {userName ? (
          <div className="ops-sidebar-profile">
            <span>{userName.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{userName}</strong>
              {userRole ? <small>{userRole}</small> : null}
            </div>
          </div>
        ) : null}
        {title ? <h1 className="font-display">{title}</h1> : null}
        {subtitle ? <p>{subtitle}</p> : null}
        <nav>
          {items.map((item, index) => (
            <button
              key={item}
              className={(activeTab ?? items[0]) === item || (!activeTab && index === 0) ? "active" : ""}
              type="button"
              onClick={() => onTabChange?.(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section className="ops-main">
        {title || subtitle ? (
          <div className="ops-top">
            <div>
              {scope === "admin" ? <span className="eyebrow dark">HQ operations</span> : null}
              {title ? <h2 className="font-display">{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <Button>New trip</Button>
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
