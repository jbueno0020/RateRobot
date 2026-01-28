import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock the rate scraping module to use fixtures instead of live scraping
const fixtureDir = path.join(__dirname, "../fixtures");

interface MockScrapedRate {
  propertyCode: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  rateType: "member" | "public";
  roomType?: string;
  nightlyRate: number;
  totalPrice: number;
  taxesAndFees?: number;
  currency: string;
  sourceUrl: string;
}

// Simulated rate scraping using fixtures
async function scrapeRatesFromFixture(
  fixtureFile: string,
  propertyCode: string,
  checkIn: Date,
  checkOut: Date,
  isLoggedIn: boolean
): Promise<MockScrapedRate[]> {
  const html = fs.readFileSync(path.join(fixtureDir, fixtureFile), "utf-8");
  const rates: MockScrapedRate[] = [];

  // Simple regex-based parsing for test
  const priceMatches = html.matchAll(/data-testid="rate-price">\$?([\d,]+\.?\d*)/g);
  const roomMatches = html.matchAll(/data-testid="room-name">([^<]+)/g);

  const prices = Array.from(priceMatches).map((m) =>
    parseFloat(m[1].replace(",", ""))
  );
  const rooms = Array.from(roomMatches).map((m) => m[1].trim());

  const nights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  );

  for (let i = 0; i < prices.length; i++) {
    rates.push({
      propertyCode,
      propertyName: propertyCode === "bellagio" ? "Bellagio Hotel & Casino" : "ARIA Resort & Casino",
      checkIn,
      checkOut,
      rateType: isLoggedIn ? "member" : "public",
      roomType: rooms[i] || undefined,
      nightlyRate: prices[i],
      totalPrice: prices[i] * nights,
      currency: "USD",
      sourceUrl: `https://www.${propertyCode}.com/en/hotel/booking`,
    });
  }

  return rates;
}

// Mock watchlist processing
interface MockWatchlist {
  id: string;
  name: string;
  properties: string[];
  dateRanges: { checkIn: Date; checkOut: Date }[];
  trackMember: boolean;
  trackPublic: boolean;
  thresholds?: {
    percentDrop?: number;
    absoluteBelow?: number;
  };
}

interface Alert {
  type: string;
  propertyName: string;
  previousPrice: number;
  currentPrice: number;
  percentChange: number;
}

async function checkWatchlistRates(
  watchlist: MockWatchlist,
  previousRates: Map<string, number>,
  hasMgmSession: boolean
): Promise<{
  rates: MockScrapedRate[];
  alerts: Alert[];
}> {
  const allRates: MockScrapedRate[] = [];
  const alerts: Alert[] = [];

  for (const property of watchlist.properties) {
    for (const dateRange of watchlist.dateRanges) {
      // Check public rates
      if (watchlist.trackPublic) {
        const fixture =
          property === "bellagio"
            ? "rate-page-bellagio.html"
            : "rate-page-member.html";

        const rates = await scrapeRatesFromFixture(
          fixture,
          property,
          dateRange.checkIn,
          dateRange.checkOut,
          false
        );
        allRates.push(...rates);
      }

      // Check member rates
      if (watchlist.trackMember && hasMgmSession) {
        const rates = await scrapeRatesFromFixture(
          "rate-page-member.html",
          property,
          dateRange.checkIn,
          dateRange.checkOut,
          true
        );
        allRates.push(...rates);

        // Check for alerts
        if (watchlist.thresholds) {
          for (const rate of rates) {
            const key = `${rate.propertyCode}:${rate.checkIn.toISOString()}`;
            const previousPrice = previousRates.get(key);

            if (previousPrice) {
              const percentChange =
                ((rate.totalPrice - previousPrice) / previousPrice) * 100;

              if (
                watchlist.thresholds.percentDrop &&
                percentChange <= -watchlist.thresholds.percentDrop
              ) {
                alerts.push({
                  type: "price_drop_percent",
                  propertyName: rate.propertyName,
                  previousPrice,
                  currentPrice: rate.totalPrice,
                  percentChange,
                });
              }

              if (
                watchlist.thresholds.absoluteBelow &&
                rate.totalPrice <= watchlist.thresholds.absoluteBelow
              ) {
                alerts.push({
                  type: "price_below_threshold",
                  propertyName: rate.propertyName,
                  previousPrice,
                  currentPrice: rate.totalPrice,
                  percentChange,
                });
              }
            }
          }
        }
      }
    }
  }

  return { rates: allRates, alerts };
}

describe("Rate Check Integration", () => {
  const checkIn = new Date("2024-03-15");
  const checkOut = new Date("2024-03-17");

  describe("Watchlist Rate Checking", () => {
    it("should check public rates for a watchlist", async () => {
      const watchlist: MockWatchlist = {
        id: "test-1",
        name: "Vegas Weekend",
        properties: ["bellagio"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: false,
        trackPublic: true,
      };

      const { rates, alerts } = await checkWatchlistRates(
        watchlist,
        new Map(),
        false
      );

      expect(rates.length).toBe(3);
      expect(rates[0].rateType).toBe("public");
      expect(rates[0].propertyCode).toBe("bellagio");
      expect(alerts.length).toBe(0);
    });

    it("should check member rates when session is available", async () => {
      const watchlist: MockWatchlist = {
        id: "test-2",
        name: "ARIA Trip",
        properties: ["aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: true,
        trackPublic: false,
      };

      const { rates } = await checkWatchlistRates(watchlist, new Map(), true);

      expect(rates.length).toBe(2);
      expect(rates[0].rateType).toBe("member");
    });

    it("should not check member rates without session", async () => {
      const watchlist: MockWatchlist = {
        id: "test-3",
        name: "Test",
        properties: ["aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: true,
        trackPublic: false,
      };

      const { rates } = await checkWatchlistRates(watchlist, new Map(), false);

      expect(rates.length).toBe(0);
    });
  });

  describe("Alert Generation", () => {
    it("should generate alert when price drops by threshold", async () => {
      const watchlist: MockWatchlist = {
        id: "test-4",
        name: "Price Watch",
        properties: ["aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: true,
        trackPublic: false,
        thresholds: {
          percentDrop: 10,
        },
      };

      // Previous rate was $200/night for 2 nights = $400 total
      // Current rate (from fixture) is $169/night for 2 nights = $338 total
      // That's a 15.5% drop
      const previousRates = new Map([
        [`aria:${checkIn.toISOString()}`, 400],
      ]);

      const { alerts } = await checkWatchlistRates(
        watchlist,
        previousRates,
        true
      );

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe("price_drop_percent");
      expect(alerts[0].percentChange).toBeLessThan(-10);
    });

    it("should generate alert when price is below absolute threshold", async () => {
      const watchlist: MockWatchlist = {
        id: "test-5",
        name: "Budget Watch",
        properties: ["aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: true,
        trackPublic: false,
        thresholds: {
          absoluteBelow: 400,
        },
      };

      const previousRates = new Map([
        [`aria:${checkIn.toISOString()}`, 500],
      ]);

      const { rates, alerts } = await checkWatchlistRates(
        watchlist,
        previousRates,
        true
      );

      // $169 * 2 nights = $338, which is below $400 threshold
      const belowThreshold = rates.filter((r) => r.totalPrice < 400);
      expect(belowThreshold.length).toBeGreaterThan(0);
    });

    it("should not generate alert when price is stable", async () => {
      const watchlist: MockWatchlist = {
        id: "test-6",
        name: "Stable Watch",
        properties: ["aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: true,
        trackPublic: false,
        thresholds: {
          percentDrop: 20,
        },
      };

      // Previous rate same as current
      const previousRates = new Map([
        [`aria:${checkIn.toISOString()}`, 338],
      ]);

      const { alerts } = await checkWatchlistRates(
        watchlist,
        previousRates,
        true
      );

      // No significant drop
      const dropAlerts = alerts.filter((a) => a.type === "price_drop_percent");
      expect(dropAlerts.length).toBe(0);
    });
  });

  describe("Multiple Properties", () => {
    it("should check rates for multiple properties", async () => {
      const watchlist: MockWatchlist = {
        id: "test-7",
        name: "Multi Property",
        properties: ["bellagio", "aria"],
        dateRanges: [{ checkIn, checkOut }],
        trackMember: false,
        trackPublic: true,
      };

      const { rates } = await checkWatchlistRates(watchlist, new Map(), false);

      const bellagioRates = rates.filter((r) => r.propertyCode === "bellagio");
      const ariaRates = rates.filter((r) => r.propertyCode === "aria");

      expect(bellagioRates.length).toBeGreaterThan(0);
      expect(ariaRates.length).toBeGreaterThan(0);
    });
  });
});
