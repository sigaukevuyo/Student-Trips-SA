import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SupportedCurrency = "ZAR" | "USD" | "EUR" | "GBP" | "AUD";

type CurrencyContextValue = {
  currency: SupportedCurrency;
  formatTripMoney: (cents: number) => string;
  priceNotice: string;
  setCurrency: (currency: SupportedCurrency) => void;
};

type StoredRates = {
  fetchedAt: string;
  rates: Partial<Record<SupportedCurrency, number>>;
};

const supportedCurrencies: SupportedCurrency[] = ["ZAR", "USD", "EUR", "GBP", "AUD"];
const currencyStorageKey = "student-trips:selected-currency";
const rateStorageKey = "student-trips:currency-rates";
const conversionMarkup = 1.1;

const currencyLocales: Record<SupportedCurrency, string> = {
  ZAR: "en-ZA",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  AUD: "en-AU",
};

const defaultRates: Record<SupportedCurrency, number> = {
  ZAR: 1,
  USD: 1,
  EUR: 1,
  GBP: 1,
  AUD: 1,
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getSavedCurrency(): SupportedCurrency {
  try {
    const savedCurrency = window.localStorage.getItem(currencyStorageKey) as SupportedCurrency | null;
    return savedCurrency && supportedCurrencies.includes(savedCurrency) ? savedCurrency : "ZAR";
  } catch {
    return "ZAR";
  }
}

function getSavedRates(): Record<SupportedCurrency, number> {
  try {
    const savedRates = window.localStorage.getItem(rateStorageKey);
    if (!savedRates) return defaultRates;

    const parsed = JSON.parse(savedRates) as StoredRates;
    return { ...defaultRates, ...parsed.rates };
  } catch {
    return defaultRates;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(getSavedCurrency);
  const [rates, setRates] = useState<Record<SupportedCurrency, number>>(getSavedRates);

  useEffect(() => {
    try {
      window.localStorage.setItem(currencyStorageKey, currency);
    } catch {
      // Ignore storage failures and keep in-memory currency switching working.
    }
  }, [currency]);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const response = await fetch("https://api.frankfurter.dev/v2/rates?base=ZAR&quotes=USD,EUR,GBP,AUD");
        if (!response.ok) return;

        const data = (await response.json()) as { rates?: Partial<Record<SupportedCurrency, number>> };
        const nextRates = {
          ...defaultRates,
          ...(data.rates ?? {}),
        };

        if (!active) return;

        setRates(nextRates);

        try {
          const stored: StoredRates = {
            fetchedAt: new Date().toISOString(),
            rates: nextRates,
          };
          window.localStorage.setItem(rateStorageKey, JSON.stringify(stored));
        } catch {
          // Ignore storage failures and keep the app usable.
        }
      } catch {
        // Keep cached or default rates if the live fetch fails.
      }
    }

    loadRates();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const formatTripMoney = (cents: number) => {
      const rate = rates[currency] ?? 1;
      const convertedCents = currency === "ZAR" ? cents : Math.round(cents * rate * conversionMarkup);

      return new Intl.NumberFormat(currencyLocales[currency], {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(convertedCents / 100);
    };

    const priceNotice =
      currency === "ZAR"
        ? "Charged in ZAR at checkout."
        : `Display prices in ${currency} include a 10% conversion margin. Charged in ZAR at checkout.`;

    return {
      currency,
      formatTripMoney,
      priceNotice,
      setCurrency: setCurrencyState,
    };
  }, [currency, rates]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider.");
  }

  return context;
}
