import { describe, it, expect, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import * as fs from "fs";
import * as path from "path";

// Simple rate parser functions that mirror the actual parsing logic
// These can be tested without Playwright

interface ParsedRate {
  roomType: string | undefined;
  nightlyRate: number;
  totalPrice: number;
  taxesAndFees: number | undefined;
}

/**
 * Parse rate cards from HTML content
 */
function parseRateCards(html: string): ParsedRate[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const rates: ParsedRate[] = [];

  const roomCards = document.querySelectorAll('[data-testid="room-card"], .room-card');

  roomCards.forEach((card) => {
    // Get room type
    const roomNameEl = card.querySelector('[data-testid="room-name"], .room-name');
    const roomType = roomNameEl?.textContent?.trim();

    // Get price
    const priceEl = card.querySelector('[data-testid="rate-price"], .rate-price');
    const priceText = priceEl?.textContent?.trim() || "";
    const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
    const nightlyRate = priceMatch ? parseFloat(priceMatch[1].replace(",", "")) : 0;

    // Get taxes
    const taxesEl = card.querySelector(".taxes");
    const taxesText = taxesEl?.textContent?.trim() || "";
    const taxesMatch = taxesText.match(/\$?([\d,]+\.?\d*)/);
    const taxesAndFees = taxesMatch ? parseFloat(taxesMatch[1].replace(",", "")) : undefined;

    // Assume 1 night for this test
    const totalPrice = nightlyRate;

    if (nightlyRate > 0) {
      rates.push({
        roomType,
        nightlyRate,
        totalPrice,
        taxesAndFees,
      });
    }
  });

  return rates;
}

/**
 * Parse JSON-LD structured data from HTML
 */
function parseJsonLd(html: string): ParsedRate[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const rates: ParsedRate[] = [];

  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  scripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || "");

      if (data.offers) {
        const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
        offers.forEach((offer: any) => {
          if (offer.price) {
            rates.push({
              roomType: offer.name,
              nightlyRate: parseFloat(offer.price),
              totalPrice: parseFloat(offer.price),
              taxesAndFees: undefined,
            });
          }
        });
      }
    } catch {
      // Ignore parse errors
    }
  });

  return rates;
}

/**
 * Check if page shows logged-in state
 */
function isLoggedIn(html: string): boolean {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const indicators = [
    '[data-testid="account-menu"]',
    ".logged-in-user",
    ".mlife-points",
    ".mlife-tier",
  ];

  for (const selector of indicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  return false;
}

describe("Rate Parser", () => {
  let publicHtml: string;
  let memberHtml: string;

  beforeAll(() => {
    publicHtml = fs.readFileSync(
      path.join(__dirname, "../fixtures/rate-page-bellagio.html"),
      "utf-8"
    );
    memberHtml = fs.readFileSync(
      path.join(__dirname, "../fixtures/rate-page-member.html"),
      "utf-8"
    );
  });

  describe("parseRateCards", () => {
    it("should parse room cards from public rate page", () => {
      const rates = parseRateCards(publicHtml);

      expect(rates.length).toBe(3);

      expect(rates[0].roomType).toBe("Bellagio Room, 2 Queens");
      expect(rates[0].nightlyRate).toBe(189);
      expect(rates[0].taxesAndFees).toBe(45.32);

      expect(rates[1].roomType).toBe("Bellagio Room, 1 King");
      expect(rates[1].nightlyRate).toBe(199);

      expect(rates[2].roomType).toBe("Salone Suite");
      expect(rates[2].nightlyRate).toBe(349);
    });

    it("should parse member rate page", () => {
      const rates = parseRateCards(memberHtml);

      expect(rates.length).toBe(2);

      expect(rates[0].roomType).toBe("Deluxe Room, 1 King");
      expect(rates[0].nightlyRate).toBe(169);

      expect(rates[1].roomType).toBe("Sky Suite, 1 King");
      expect(rates[1].nightlyRate).toBe(329);
    });

    it("should handle empty page", () => {
      const rates = parseRateCards("<html><body></body></html>");
      expect(rates.length).toBe(0);
    });
  });

  describe("parseJsonLd", () => {
    it("should parse JSON-LD offers from page", () => {
      const rates = parseJsonLd(publicHtml);

      expect(rates.length).toBe(2);
      expect(rates[0].nightlyRate).toBe(189);
      expect(rates[1].nightlyRate).toBe(199);
    });

    it("should handle missing JSON-LD", () => {
      const rates = parseJsonLd("<html><body></body></html>");
      expect(rates.length).toBe(0);
    });
  });

  describe("isLoggedIn", () => {
    it("should detect logged-out state", () => {
      expect(isLoggedIn(publicHtml)).toBe(false);
    });

    it("should detect logged-in state", () => {
      expect(isLoggedIn(memberHtml)).toBe(true);
    });
  });
});

describe("Price Calculations", () => {
  it("should calculate total for multi-night stay", () => {
    const nightlyRate = 189;
    const nights = 3;
    const taxesPerNight = 45.32;
    const resortFeePerNight = 45;

    const subtotal = nightlyRate * nights;
    const totalTaxes = taxesPerNight * nights;
    const totalResortFee = resortFeePerNight * nights;
    const grandTotal = subtotal + totalTaxes + totalResortFee;

    expect(subtotal).toBe(567);
    expect(grandTotal).toBeCloseTo(837.96);
  });

  it("should calculate percent change correctly", () => {
    const previousPrice = 200;
    const currentPrice = 180;
    const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    expect(percentChange).toBe(-10);
  });

  it("should detect price drop threshold", () => {
    const previousPrice = 300;
    const currentPrice = 255;
    const threshold = 10; // 10% drop

    const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;
    const shouldAlert = percentChange <= -threshold;

    expect(percentChange).toBe(-15);
    expect(shouldAlert).toBe(true);
  });

  it("should detect absolute price threshold", () => {
    const currentPrice = 145;
    const threshold = 150;

    expect(currentPrice <= threshold).toBe(true);
  });
});
