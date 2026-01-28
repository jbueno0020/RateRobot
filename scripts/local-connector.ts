#!/usr/bin/env node
/**
 * Rate Robot Local Connector
 *
 * This script runs on your local machine to securely connect your MGM session.
 * It opens a browser window for you to log in, then captures the session
 * cookies and uploads them to Rate Robot.
 *
 * Your MGM password is NEVER transmitted or stored.
 *
 * Usage:
 *   npm run connector
 *   # Then enter the 6-character code from the Rate Robot web app
 */

import { chromium } from "playwright";
import * as readline from "readline";

const MGM_LOGIN_URL = "https://www.mgmresorts.com/en/sign-in.html";
const MGM_ACCOUNT_URL = "https://www.mgmresorts.com/en/my-account.html";

// Get app URL from env or use default
const APP_URL = process.env.RATE_ROBOT_URL || "http://localhost:3000";

interface MgmCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface SessionData {
  cookies: MgmCookie[];
  capturedAt: string;
  userAgent: string;
  accountMarker?: string;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function checkLoginState(page: any): Promise<boolean> {
  try {
    const indicators = [
      '[data-testid="account-menu"]',
      ".logged-in-user",
      ".user-account",
      'a[href*="sign-out"]',
      'button[aria-label*="Account"]',
      ".mlife-points",
    ];

    for (const selector of indicators) {
      const element = await page.$(selector);
      if (element) return true;
    }

    const content = await page.content();
    if (
      content.includes("M life") &&
      content.includes("Welcome") &&
      !content.includes("Sign In")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function extractAccountMarker(page: any): Promise<string | undefined> {
  try {
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
        if (text?.trim()) {
          const trimmed = text.trim();
          if (trimmed.includes("@")) {
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

async function main() {
  console.log("\n========================================");
  console.log("     Rate Robot Local Connector");
  console.log("========================================\n");
  console.log("This script will:");
  console.log("1. Open a browser window");
  console.log("2. Let you log in to your MGM account");
  console.log("3. Capture your session cookies (NOT your password)");
  console.log("4. Upload them securely to Rate Robot\n");

  const code = await prompt("Enter the 6-character code from Rate Robot: ");

  if (!/^[A-Z0-9]{6}$/.test(code.toUpperCase())) {
    console.error("Invalid code format. Please enter a 6-character code.");
    process.exit(1);
  }

  console.log("\nLaunching browser...\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    console.log("Opening MGM login page...");
    await page.goto(MGM_LOGIN_URL, { waitUntil: "networkidle" });

    console.log("\n========================================");
    console.log("  Please log in to your MGM account");
    console.log("  in the browser window that opened.");
    console.log("========================================\n");
    console.log("Waiting for login (up to 5 minutes)...\n");

    // Wait for login
    const maxWait = 5 * 60 * 1000;
    const checkInterval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      const currentUrl = page.url();
      const isLoggedIn = await checkLoginState(page);

      if (
        isLoggedIn ||
        currentUrl.includes("my-account") ||
        currentUrl.includes("dashboard")
      ) {
        console.log("Login detected!");
        break;
      }

      // Show progress every 30 seconds
      if (elapsed % 30000 === 0) {
        console.log(`Still waiting... (${elapsed / 1000}s)`);
      }
    }

    if (elapsed >= maxWait) {
      throw new Error("Login timeout - please try again");
    }

    console.log("Navigating to account page...");
    await page.goto(MGM_ACCOUNT_URL, { waitUntil: "networkidle" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Extracting session data...");

    // Get cookies
    const cookies = await context.cookies();
    const mgmCookies = cookies.filter(
      (c) =>
        c.domain.includes("mgmresorts.com") ||
        c.domain.includes("mgmgrand.com") ||
        c.domain.includes("bellagio.com") ||
        c.domain.includes("aria.com") ||
        c.domain.includes("mirage.com") ||
        c.domain.includes("mandalaybay.com")
    );

    const accountMarker = await extractAccountMarker(page);

    const sessionData: SessionData = {
      cookies: mgmCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as "Strict" | "Lax" | "None",
      })),
      capturedAt: new Date().toISOString(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      accountMarker,
    };

    console.log(`Captured ${mgmCookies.length} MGM cookies`);
    if (accountMarker) {
      console.log(`Account: ${accountMarker}`);
    }

    console.log("\nUploading to Rate Robot...");

    const response = await fetch(`${APP_URL}/api/mgm-session/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        sessionData,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Upload failed");
    }

    console.log("\n========================================");
    console.log("  SUCCESS! Your MGM session is now");
    console.log("  connected to Rate Robot.");
    console.log("========================================\n");
    console.log("You can close this window and return to the web app.\n");
  } catch (error) {
    console.error("\n========================================");
    console.error("  ERROR:", error instanceof Error ? error.message : error);
    console.error("========================================\n");
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
