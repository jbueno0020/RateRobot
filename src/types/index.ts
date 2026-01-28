// Rate Robot Type Definitions

// ============================================
// MGM Properties
// ============================================

export interface MgmProperty {
  code: string;
  name: string;
  shortName: string;
  location: string;
  bookingUrl: string;
}

export const MGM_PROPERTIES: MgmProperty[] = [
  {
    code: "bellagio",
    name: "Bellagio Hotel & Casino",
    shortName: "Bellagio",
    location: "Las Vegas",
    bookingUrl: "https://www.bellagio.com/en/hotel.html",
  },
  {
    code: "aria",
    name: "ARIA Resort & Casino",
    shortName: "ARIA",
    location: "Las Vegas",
    bookingUrl: "https://www.aria.com/en/hotel.html",
  },
  {
    code: "mgm-grand",
    name: "MGM Grand Hotel & Casino",
    shortName: "MGM Grand",
    location: "Las Vegas",
    bookingUrl: "https://www.mgmgrand.com/en/hotel.html",
  },
  {
    code: "vdara",
    name: "Vdara Hotel & Spa",
    shortName: "Vdara",
    location: "Las Vegas",
    bookingUrl: "https://www.vdara.com/en/hotel.html",
  },
  {
    code: "mandalay-bay",
    name: "Mandalay Bay Resort & Casino",
    shortName: "Mandalay Bay",
    location: "Las Vegas",
    bookingUrl: "https://www.mandalaybay.com/en/hotel.html",
  },
  {
    code: "delano",
    name: "Delano Las Vegas",
    shortName: "Delano",
    location: "Las Vegas",
    bookingUrl: "https://www.delanolasvegas.com/en/hotel.html",
  },
  {
    code: "park-mgm",
    name: "Park MGM",
    shortName: "Park MGM",
    location: "Las Vegas",
    bookingUrl: "https://www.parkmgm.com/en/hotel.html",
  },
  {
    code: "nomad",
    name: "NoMad Las Vegas",
    shortName: "NoMad",
    location: "Las Vegas",
    bookingUrl: "https://www.nomadlasvegas.com/en/hotel.html",
  },
  {
    code: "mirage",
    name: "The Mirage",
    shortName: "Mirage",
    location: "Las Vegas",
    bookingUrl: "https://www.mirage.com/en/hotel.html",
  },
  {
    code: "new-york-new-york",
    name: "New York-New York Hotel & Casino",
    shortName: "NYNY",
    location: "Las Vegas",
    bookingUrl: "https://www.newyorknewyork.com/en/hotel.html",
  },
  {
    code: "luxor",
    name: "Luxor Hotel & Casino",
    shortName: "Luxor",
    location: "Las Vegas",
    bookingUrl: "https://www.luxor.com/en/hotel.html",
  },
  {
    code: "excalibur",
    name: "Excalibur Hotel & Casino",
    shortName: "Excalibur",
    location: "Las Vegas",
    bookingUrl: "https://www.excalibur.com/en/hotel.html",
  },
  {
    code: "borgata",
    name: "Borgata Hotel Casino & Spa",
    shortName: "Borgata",
    location: "Atlantic City",
    bookingUrl: "https://www.theborgata.com/hotel",
  },
  {
    code: "mgm-national-harbor",
    name: "MGM National Harbor",
    shortName: "MGM National Harbor",
    location: "Maryland",
    bookingUrl: "https://www.mgmnationalharbor.com/en/hotel.html",
  },
  {
    code: "beau-rivage",
    name: "Beau Rivage Resort & Casino",
    shortName: "Beau Rivage",
    location: "Biloxi",
    bookingUrl: "https://www.beaurivage.com/en/hotel.html",
  },
];

// ============================================
// Date Rules
// ============================================

export type DateRuleType = "specific" | "recurring";

export interface SpecificDateRange {
  checkIn: string; // ISO date string
  checkOut: string;
}

export interface SpecificDateRules {
  type: "specific";
  ranges: SpecificDateRange[];
}

export interface RecurringDateRules {
  type: "recurring";
  pattern: "first-weekend" | "last-weekend" | "every-weekend" | "custom";
  // For custom patterns
  dayOfWeek?: number; // 0-6
  weekOfMonth?: number; // 1-4
  nights: number;
  monthsAhead: number; // How many months ahead to check
}

export type DateRules = SpecificDateRules | RecurringDateRules;

// ============================================
// Thresholds
// ============================================

export interface PriceThresholds {
  percentDrop?: number; // Alert when price drops by this percentage
  absoluteBelow?: number; // Alert when price is below this amount
}

// ============================================
// Rate Information
// ============================================

export interface ScrapedRate {
  propertyCode: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  rateType: "member" | "public";
  roomType?: string;
  nightlyRate: number;
  totalPrice: number;
  taxesAndFees?: number;
  resortFee?: number;
  currency: string;
  sourceUrl: string;
  rawJson?: string;
}

// ============================================
// Session & Auth
// ============================================

export interface UserSession {
  userId: string;
  email: string;
  exp: number;
}

export interface MgmCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface MgmSessionData {
  cookies: MgmCookie[];
  capturedAt: string;
  userAgent: string;
  accountMarker?: string;
}

// ============================================
// API Responses
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// Watchlist with computed fields
// ============================================

export interface WatchlistWithStats {
  id: string;
  name: string;
  properties: MgmProperty[];
  dateRules: DateRules;
  trackMember: boolean;
  trackPublic: boolean;
  thresholds: PriceThresholds | null;
  isActive: boolean;
  alertsMuted: boolean;
  lastCheckedAt: Date | null;
  nextCheckAt: Date | null;
  // Computed stats
  currentBestPrice?: number;
  priceChange24h?: number;
  alertCount?: number;
}

// ============================================
// Dashboard Stats
// ============================================

export interface DashboardStats {
  totalWatchlists: number;
  activeWatchlists: number;
  totalObservations: number;
  unreadAlerts: number;
  mgmSessionActive: boolean;
  mgmSessionExpires?: Date;
}

// ============================================
// Price History
// ============================================

export interface PricePoint {
  date: Date;
  memberPrice?: number;
  publicPrice?: number;
}

export interface PriceHistory {
  propertyCode: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  points: PricePoint[];
}
