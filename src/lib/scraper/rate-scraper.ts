import { BrowserContext, Page } from "playwright";
import { format } from "date-fns";
import {
  createContext,
  checkMgmLoginState,
  waitWithJitter,
} from "./browser";
import type { MgmCookie, ScrapedRate } from "@/types";
import { MGM_PROPERTIES } from "@/types";

/**
 * Property booking URLs
 */
const PROPERTY_BOOKING_URLS: Record<string, string> = {
  bellagio: "https://www.bellagio.com/en/hotel/hotel-booking.html",
  aria: "https://www.aria.com/en/hotel/hotel-booking.html",
  "mgm-grand": "https://www.mgmgrand.com/en/hotel/hotel-booking.html",
  vdara: "https://www.vdara.com/en/hotel/hotel-booking.html",
  "mandalay-bay": "https://www.mandalaybay.com/en/hotel/hotel-booking.html",
  delano: "https://www.delanolasvegas.com/en/hotel/hotel-booking.html",
  "park-mgm": "https://www.parkmgm.com/en/hotel/hotel-booking.html",
  nomad: "https://www.nomadlasvegas.com/en/hotel/hotel-booking.html",
  mirage: "https://www.mirage.com/en/hotel/hotel-booking.html",
  "new-york-new-york": "https://www.newyorknewyork.com/en/hotel/hotel-booking.html",
  luxor: "https://www.luxor.com/en/hotel/hotel-booking.html",
  excalibur: "https://www.excalibur.com/en/hotel/hotel-booking.html",
  borgata: "https://www.theborgata.com/hotel/book-a-room",
  "mgm-national-harbor": "https://www.mgmnationalharbor.com/en/hotel/hotel-booking.html",
  "beau-rivage": "https://www.beaurivage.com/en/hotel/hotel-booking.html",
};

/**
 * Result of rate scraping
 */
export interface RateScrapeResult {
  success: boolean;
  rates: ScrapedRate[];
  isLoggedIn: boolean;
  error?: string;
}

/**
 * Build the booking URL with dates
 */
function buildBookingUrl(
  propertyCode: string,
  checkIn: Date,
  checkOut: Date
): string {
  const baseUrl = PROPERTY_BOOKING_URLS[propertyCode];
  if (!baseUrl) {
    throw new Error(`Unknown property code: ${propertyCode}`);
  }

  const checkInStr = format(checkIn, "yyyy-MM-dd");
  const checkOutStr = format(checkOut, "yyyy-MM-dd");

  // MGM uses query params for dates
  return `${baseUrl}?checkInDate=${checkInStr}&checkOutDate=${checkOutStr}&numAdults=2&numChildren=0&numRooms=1`;
}

/**
 * Scrape rates for a specific property and date range
 */
export async function scrapeRates(
  propertyCode: string,
  checkIn: Date,
  checkOut: Date,
  cookies?: MgmCookie[]
): Promise<RateScrapeResult> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Create context with optional session cookies
    context = await createContext(cookies);
    page = await context.newPage();

    // Build booking URL
    const bookingUrl = buildBookingUrl(propertyCode, checkIn, checkOut);

    console.log(`Scraping rates for ${propertyCode}: ${bookingUrl}`);

    // Navigate to booking page
    await page.goto(bookingUrl, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for rate content to load
    await waitWithJitter(3000);

    // Check login state
    const isLoggedIn = cookies ? await checkMgmLoginState(page) : false;

    // Extract rates from the page
    const rates = await extractRates(page, propertyCode, checkIn, checkOut, isLoggedIn, bookingUrl);

    return {
      success: true,
      rates,
      isLoggedIn,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Rate scraping failed for ${propertyCode}:`, errorMessage);

    return {
      success: false,
      rates: [],
      isLoggedIn: false,
      error: errorMessage,
    };
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
}

/**
 * Extract rates from the booking page
 * This is the main parsing function - kept separate for testability
 */
export async function extractRates(
  page: Page,
  propertyCode: string,
  checkIn: Date,
  checkOut: Date,
  isLoggedIn: boolean,
  sourceUrl: string
): Promise<ScrapedRate[]> {
  const rates: ScrapedRate[] = [];
  const propertyName = MGM_PROPERTIES.find((p) => p.code === propertyCode)?.name || propertyCode;

  try {
    // Try multiple selector strategies
    const rateCards = await findRateCards(page);

    if (rateCards.length === 0) {
      // Try alternative extraction from JSON-LD or data attributes
      const jsonRates = await extractFromJsonLd(page);
      if (jsonRates.length > 0) {
        return jsonRates.map((rate) => ({
          ...rate,
          propertyCode,
          propertyName,
          checkIn,
          checkOut,
          sourceUrl,
          rateType: isLoggedIn ? "member" : "public",
        }));
      }

      console.log("No rate cards found on page");
      return [];
    }

    for (const card of rateCards) {
      try {
        const rate = await parseRateCard(card, propertyCode, propertyName, checkIn, checkOut, isLoggedIn, sourceUrl);
        if (rate) {
          rates.push(rate);
        }
      } catch (e) {
        console.error("Failed to parse rate card:", e);
      }
    }
  } catch (error) {
    console.error("Rate extraction failed:", error);
  }

  return rates;
}

/**
 * Find rate cards using multiple selector strategies
 */
async function findRateCards(page: Page): Promise<ReturnType<Page["$$"]>> {
  const selectors = [
    // Common MGM rate card selectors
    '[data-testid="room-card"]',
    '[data-testid="rate-card"]',
    ".room-card",
    ".rate-tile",
    ".room-tile",
    ".hotel-room-card",
    ".room-type-card",
    '[class*="RoomCard"]',
    '[class*="room-card"]',
    // Fallback generic
    '[class*="price"]',
  ];

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`Found ${elements.length} rate cards using selector: ${selector}`);
      return elements;
    }
  }

  return [];
}

/**
 * Parse a single rate card element
 */
async function parseRateCard(
  card: Awaited<ReturnType<Page["$"]>>,
  propertyCode: string,
  propertyName: string,
  checkIn: Date,
  checkOut: Date,
  isLoggedIn: boolean,
  sourceUrl: string
): Promise<ScrapedRate | null> {
  if (!card) return null;

  try {
    // Try to extract room type
    const roomTypeSelectors = [
      '[data-testid="room-name"]',
      ".room-name",
      ".room-type",
      ".room-title",
      "h3",
      "h4",
    ];
    let roomType: string | undefined;
    for (const selector of roomTypeSelectors) {
      const element = await card.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim()) {
          roomType = text.trim();
          break;
        }
      }
    }

    // Try to extract price
    const priceSelectors = [
      '[data-testid="rate-price"]',
      '[data-testid="price"]',
      ".rate-price",
      ".room-price",
      ".price-value",
      ".total-price",
      '[class*="price"]',
    ];

    let priceText: string | undefined;
    for (const selector of priceSelectors) {
      const element = await card.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.includes("$")) {
          priceText = text.trim();
          break;
        }
      }
    }

    if (!priceText) {
      // Last resort: search all text for price pattern
      const cardText = await card.textContent();
      const priceMatch = cardText?.match(/\$[\d,]+(?:\.\d{2})?/);
      priceText = priceMatch?.[0];
    }

    if (!priceText) {
      console.log("No price found in rate card");
      return null;
    }

    // Parse the price
    const cleanPrice = priceText.replace(/[^0-9.]/g, "");
    const price = parseFloat(cleanPrice);

    if (isNaN(price) || price <= 0) {
      return null;
    }

    // Calculate nights
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Try to determine if this is a nightly or total price
    const cardTextLower = (await card.textContent())?.toLowerCase() || "";
    const isNightly = cardTextLower.includes("/night") ||
                      cardTextLower.includes("per night") ||
                      cardTextLower.includes("avg/night");

    const nightlyRate = isNightly ? price : price / nights;
    const totalPrice = isNightly ? price * nights : price;

    // Try to extract taxes/fees
    let taxesAndFees: number | undefined;
    const taxSelectors = [".taxes", ".fees", '[class*="fee"]', '[class*="tax"]'];
    for (const selector of taxSelectors) {
      const element = await card.$(selector);
      if (element) {
        const text = await element.textContent();
        const taxMatch = text?.match(/\$[\d,]+(?:\.\d{2})?/);
        if (taxMatch) {
          taxesAndFees = parseFloat(taxMatch[0].replace(/[^0-9.]/g, ""));
          break;
        }
      }
    }

    return {
      propertyCode,
      propertyName,
      checkIn,
      checkOut,
      rateType: isLoggedIn ? "member" : "public",
      roomType,
      nightlyRate,
      totalPrice,
      taxesAndFees,
      currency: "USD",
      sourceUrl,
    };
  } catch (error) {
    console.error("Error parsing rate card:", error);
    return null;
  }
}

/**
 * Try to extract rates from JSON-LD structured data
 */
async function extractFromJsonLd(
  page: Page
): Promise<Partial<ScrapedRate>[]> {
  try {
    const jsonLdScripts = await page.$$('script[type="application/ld+json"]');
    const rates: Partial<ScrapedRate>[] = [];

    for (const script of jsonLdScripts) {
      const content = await script.textContent();
      if (!content) continue;

      try {
        const data = JSON.parse(content);

        // Look for Hotel or LodgingBusiness schema
        if (data["@type"] === "Hotel" || data["@type"] === "LodgingBusiness") {
          if (data.priceRange) {
            const priceMatch = data.priceRange.match(/\$?(\d+)/);
            if (priceMatch) {
              rates.push({
                nightlyRate: parseFloat(priceMatch[1]),
                totalPrice: parseFloat(priceMatch[1]),
                currency: "USD",
              });
            }
          }
        }

        // Look for Offer schema
        if (data["@type"] === "Offer" || data.offers) {
          const offers = data.offers || [data];
          for (const offer of Array.isArray(offers) ? offers : [offers]) {
            if (offer.price) {
              rates.push({
                nightlyRate: parseFloat(offer.price),
                totalPrice: parseFloat(offer.price),
                currency: offer.priceCurrency || "USD",
              });
            }
          }
        }
      } catch (parseError) {
        // Ignore JSON parse errors
      }
    }

    return rates;
  } catch (error) {
    return [];
  }
}

/**
 * Scrape rates for multiple properties
 * Includes rate limiting and jitter
 */
export async function scrapeMultipleProperties(
  properties: string[],
  checkIn: Date,
  checkOut: Date,
  cookies?: MgmCookie[],
  delayMs = 5000
): Promise<Map<string, RateScrapeResult>> {
  const results = new Map<string, RateScrapeResult>();

  for (const propertyCode of properties) {
    const result = await scrapeRates(propertyCode, checkIn, checkOut, cookies);
    results.set(propertyCode, result);

    // Add delay between requests with jitter
    if (properties.indexOf(propertyCode) < properties.length - 1) {
      const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
    }
  }

  return results;
}
