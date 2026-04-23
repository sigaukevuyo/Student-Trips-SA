import { Menu } from "lucide-react";
import { useState } from "react";

import { useCurrency, type SupportedCurrency } from "../../lib/currency";
import { navItems, type View } from "../navigation";
import { cx } from "../utils/cx";

export function AppHeader({
  activeView,
  isLoggedIn,
  onDashboardClick,
  onSignOut,
  setView,
}: {
  activeView: View;
  isLoggedIn: boolean;
  onDashboardClick: () => void;
  onSignOut: () => void;
  setView: (view: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button className="brand" onClick={() => setView("home")} type="button">
          <img src="/assets/LOGO.png" alt="Student Trips SA" />
        </button>

        <nav className="desktop-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={cx("nav-link", (item.view === activeView || (item.view === "cities" && activeView === "cityDetail")) && "active")}
              onClick={() => setView(item.view ?? "home")}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <select
            className="currency-select"
            value={currency}
            aria-label="Currency"
            onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}
          >
            <option value="ZAR">ZAR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AUD">AUD</option>
          </select>
          <button className="header-pill" onClick={onDashboardClick} type="button">
            {isLoggedIn ? "Dashboard" : "Login"}
          </button>
          {isLoggedIn ? (
            <button className="header-link-button" onClick={onSignOut} type="button">
              Sign Out
            </button>
          ) : null}
          <button className="icon-button mobile-only" onClick={() => setOpen((value) => !value)} type="button">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {open ? (
        <nav className="mobile-nav container">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={cx("nav-link", (item.view === activeView || (item.view === "cities" && activeView === "cityDetail")) && "active")}
              onClick={() => {
                setView(item.view ?? "home");
                setOpen(false);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
