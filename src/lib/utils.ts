import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(checkIn: Date | string, checkOut: Date | string): string {
  const inDate = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const outDate = typeof checkOut === "string" ? new Date(checkOut) : checkOut;

  const inStr = inDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const outStr = outDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return `${inStr} - ${outStr}`;
}

export function formatPercentChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function getPropertyName(code: string): string {
  const propertyNames: Record<string, string> = {
    bellagio: "Bellagio",
    aria: "ARIA",
    "mgm-grand": "MGM Grand",
    vdara: "Vdara",
    "mandalay-bay": "Mandalay Bay",
    delano: "Delano",
    "park-mgm": "Park MGM",
    nomad: "NoMad",
    mirage: "The Mirage",
    "new-york-new-york": "NYNY",
    luxor: "Luxor",
    excalibur: "Excalibur",
    borgata: "Borgata",
    "mgm-national-harbor": "MGM National Harbor",
    "beau-rivage": "Beau Rivage",
  };
  return propertyNames[code] || code;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addJitter(baseMs: number, jitterPercent = 0.2): number {
  const jitter = baseMs * jitterPercent * (Math.random() * 2 - 1);
  return Math.max(0, baseMs + jitter);
}
