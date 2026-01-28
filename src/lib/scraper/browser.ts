import { chromium, Browser, BrowserContext, Page, Cookie } from "playwright";
import type { MgmCookie, MgmSessionData } from "@/types";

let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance
 * Uses singleton pattern to reuse browser across scraping operations
 */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
  const slowMo = parseInt(process.env.PLAYWRIGHT_SLOW_MO || "0");

  browserInstance = await chromium.launch({
    headless,
    slowMo,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  return browserInstance;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Create a new browser context with anti-detection measures
 */
export async function createContext(
  cookies?: MgmCookie[]
): Promise<BrowserContext> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Add cookies if provided
  if (cookies && cookies.length > 0) {
    const playwrightCookies: Cookie[] = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires || -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: (cookie.sameSite as "Strict" | "Lax" | "None") || "None",
    }));
    await context.addCookies(playwrightCookies);
  }

  // Add stealth scripts
  await context.addInitScript(() => {
    // Override webdriver detection
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Override plugins length
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  return context;
}

/**
 * Convert Playwright cookies to our format
 */
export function convertCookies(playwrightCookies: Cookie[]): MgmCookie[] {
  return playwrightCookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite as "Strict" | "Lax" | "None",
  }));
}

/**
 * Extract session data from a browser context
 */
export async function extractSessionData(
  context: BrowserContext
): Promise<MgmSessionData> {
  const cookies = await context.cookies();

  // Filter to only include relevant MGM cookies
  const mgmCookies = cookies.filter(
    (cookie) =>
      cookie.domain.includes("mgmresorts.com") ||
      cookie.domain.includes("mgmgrand.com") ||
      cookie.domain.includes("bellagio.com") ||
      cookie.domain.includes("aria.com") ||
      cookie.domain.includes("mirage.com") ||
      cookie.domain.includes("mandalaybay.com")
  );

  return {
    cookies: convertCookies(mgmCookies),
    capturedAt: new Date().toISOString(),
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
}

/**
 * Check if we're logged in to MGM
 */
export async function checkMgmLoginState(page: Page): Promise<boolean> {
  try {
    // Try multiple selectors that indicate logged-in state
    const loggedInIndicators = [
      '[data-testid="account-menu"]',
      ".logged-in-user",
      ".user-account",
      'a[href*="sign-out"]',
      'button[aria-label*="Account"]',
      ".mlife-points",
    ];

    for (const selector of loggedInIndicators) {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    }

    // Check for M life number in page content
    const pageContent = await page.content();
    if (
      pageContent.includes("M life") &&
      pageContent.includes("Welcome") &&
      !pageContent.includes("Sign In")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Wait with random jitter
 */
export async function waitWithJitter(
  baseMs: number,
  jitterPercent = 0.2
): Promise<void> {
  const jitter = baseMs * jitterPercent * (Math.random() * 2 - 1);
  const waitTime = Math.max(100, baseMs + jitter);
  await new Promise((resolve) => setTimeout(resolve, waitTime));
}
