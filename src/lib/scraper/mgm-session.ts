import { BrowserContext, Page } from "playwright";
import {
  createContext,
  extractSessionData,
  checkMgmLoginState,
  waitWithJitter,
  closeBrowser,
} from "./browser";
import type { MgmSessionData, MgmCookie } from "@/types";

const MGM_LOGIN_URL = "https://www.mgmresorts.com/en/sign-in.html";
const MGM_ACCOUNT_URL = "https://www.mgmresorts.com/en/my-account.html";

/**
 * Result of interactive login
 */
export interface InteractiveLoginResult {
  success: boolean;
  sessionData?: MgmSessionData;
  accountMarker?: string;
  error?: string;
}

/**
 * Perform interactive MGM login
 * Opens a browser window for the user to log in manually
 * Returns session cookies after successful login
 *
 * This is used in local development mode or via the local connector script
 */
export async function performInteractiveLogin(): Promise<InteractiveLoginResult> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Create a non-headless context for interactive login
    context = await createContext();
    page = await context.newPage();

    console.log("Opening MGM login page...");
    await page.goto(MGM_LOGIN_URL, { waitUntil: "networkidle" });

    // Wait for user to complete login (up to 5 minutes)
    console.log("Waiting for user to complete login...");
    console.log("Please complete the login process in the browser window.");
    console.log("The browser will close automatically after successful login.");

    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const checkInterval = 2000; // Check every 2 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      await waitWithJitter(checkInterval);
      elapsed += checkInterval;

      // Check if we're now on a logged-in page
      const currentUrl = page.url();
      const isLoggedIn = await checkMgmLoginState(page);

      if (
        isLoggedIn ||
        currentUrl.includes("my-account") ||
        currentUrl.includes("dashboard")
      ) {
        console.log("Login detected! Extracting session data...");

        // Navigate to account page to ensure all cookies are set
        await page.goto(MGM_ACCOUNT_URL, { waitUntil: "networkidle" });
        await waitWithJitter(2000);

        // Extract session data
        const sessionData = await extractSessionData(context);

        // Try to get account marker (masked email or M life number)
        const accountMarker = await extractAccountMarker(page);

        return {
          success: true,
          sessionData,
          accountMarker,
        };
      }
    }

    return {
      success: false,
      error: "Login timeout - user did not complete login within 5 minutes",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Login failed: ${errorMessage}`,
    };
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
}

/**
 * Restore session from stored cookies and verify it's still valid
 */
export async function verifySession(
  cookies: MgmCookie[]
): Promise<{
  valid: boolean;
  accountMarker?: string;
  error?: string;
}> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await createContext(cookies);
    page = await context.newPage();

    // Navigate to account page
    await page.goto(MGM_ACCOUNT_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for page to stabilize
    await waitWithJitter(2000);

    // Check if redirected to login page
    const currentUrl = page.url();
    if (
      currentUrl.includes("sign-in") ||
      currentUrl.includes("login") ||
      !currentUrl.includes("my-account")
    ) {
      return {
        valid: false,
        error: "Session expired - redirected to login",
      };
    }

    // Check login state
    const isLoggedIn = await checkMgmLoginState(page);
    if (!isLoggedIn) {
      return {
        valid: false,
        error: "Session expired - not logged in",
      };
    }

    // Get account marker
    const accountMarker = await extractAccountMarker(page);

    return {
      valid: true,
      accountMarker,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      valid: false,
      error: `Session verification failed: ${errorMessage}`,
    };
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
}

/**
 * Extract account marker from the account page
 * This is non-sensitive info like masked email or M life tier
 */
async function extractAccountMarker(page: Page): Promise<string | undefined> {
  try {
    // Try to find M life tier or masked email
    const selectors = [
      ".mlife-tier",
      ".account-name",
      ".user-name",
      '[data-testid="user-name"]',
      ".welcome-message",
    ];

    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim()) {
          // Return truncated/masked version
          const trimmed = text.trim();
          if (trimmed.includes("@")) {
            // Mask email
            const [local, domain] = trimmed.split("@");
            return `${local.slice(0, 2)}***@${domain}`;
          }
          return trimmed.slice(0, 20);
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Cleanup - close browser when done
 */
export async function cleanup(): Promise<void> {
  await closeBrowser();
}
