/**
 * Rate Robot Worker
 *
 * Background worker that checks rates on a schedule.
 * Run with: npm run worker
 */

import cron from "node-cron";
import { prisma } from "@/lib/db";
import { decryptMgmSession } from "@/lib/encryption";
import { scrapeRates, closeBrowser } from "@/lib/scraper";
import { sendPriceAlertEmail, sendSessionExpiredEmail } from "@/lib/email";
import { addDays, addMonths, startOfMonth, nextFriday, endOfMonth } from "date-fns";
import type { MgmSessionData, DateRules, PriceThresholds } from "@/types";

const CONCURRENCY_LIMIT = parseInt(process.env.RATE_CHECK_CONCURRENCY || "2");
const DELAY_BETWEEN_CHECKS = parseInt(process.env.RATE_CHECK_DELAY_MS || "5000");

let isRunning = false;

/**
 * Main worker loop
 */
async function runWorker() {
  if (isRunning) {
    console.log("Worker already running, skipping...");
    return;
  }

  isRunning = true;
  console.log(`[${new Date().toISOString()}] Starting rate check worker...`);

  try {
    // Find watchlists that need checking
    const watchlists = await prisma.watchlist.findMany({
      where: {
        isActive: true,
        nextCheckAt: {
          lte: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      take: CONCURRENCY_LIMIT,
    });

    console.log(`Found ${watchlists.length} watchlists to check`);

    for (const watchlist of watchlists) {
      try {
        await checkWatchlistRates(watchlist);
      } catch (error) {
        console.error(`Error checking watchlist ${watchlist.id}:`, error);
      }

      // Add delay between watchlists
      await sleep(DELAY_BETWEEN_CHECKS);
    }
  } catch (error) {
    console.error("Worker error:", error);
  } finally {
    isRunning = false;
    console.log(`[${new Date().toISOString()}] Worker finished`);
  }
}

/**
 * Check rates for a single watchlist
 */
async function checkWatchlistRates(watchlist: any) {
  console.log(`Checking watchlist: ${watchlist.name} (${watchlist.id})`);

  // Get MGM session if tracking member rates
  let cookies: any[] | undefined;
  let sessionValid = true;

  if (watchlist.trackMember) {
    const mgmSession = await prisma.mgmSession.findFirst({
      where: { userId: watchlist.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (mgmSession) {
      try {
        const sessionData = decryptMgmSession<MgmSessionData>({
          encrypted: mgmSession.encryptedCookieJar,
          iv: mgmSession.encryptionIv,
          tag: mgmSession.encryptionTag,
        });
        cookies = sessionData.cookies;
      } catch (e) {
        console.error("Failed to decrypt session:", e);
        sessionValid = false;

        // Mark session as inactive
        await prisma.mgmSession.update({
          where: { id: mgmSession.id },
          data: { isActive: false, lastError: "Decryption failed" },
        });

        // Send session expired alert
        await createAlert(
          watchlist.userId,
          watchlist.id,
          "session_expired",
          "MGM Session Expired",
          "Your MGM session has expired. Please reconnect to continue receiving member rates."
        );

        if (process.env.ENABLE_EMAIL_ALERTS === "true") {
          await sendSessionExpiredEmail(watchlist.user.email);
        }
      }
    }
  }

  // Parse config
  const properties = JSON.parse(watchlist.propertiesJson) as string[];
  const dateRules = JSON.parse(watchlist.dateRulesJson) as DateRules;
  const thresholds = watchlist.thresholdsJson
    ? (JSON.parse(watchlist.thresholdsJson) as PriceThresholds)
    : null;

  // Generate date ranges
  const dateRanges = generateDateRanges(dateRules);
  let totalRatesFound = 0;

  for (const property of properties) {
    for (const range of dateRanges) {
      // Get previous rate for comparison
      const previousRate = await prisma.rateObservation.findFirst({
        where: {
          watchlistId: watchlist.id,
          propertyCode: property,
          checkIn: range.checkIn,
          checkOut: range.checkOut,
        },
        orderBy: { scrapedAt: "desc" },
      });

      // Check public rates
      if (watchlist.trackPublic) {
        const result = await scrapeRates(property, range.checkIn, range.checkOut);

        if (result.success && result.rates.length > 0) {
          for (const rate of result.rates) {
            const observation = await prisma.rateObservation.create({
              data: {
                watchlistId: watchlist.id,
                propertyCode: rate.propertyCode,
                propertyName: rate.propertyName,
                checkIn: rate.checkIn,
                checkOut: rate.checkOut,
                rateType: "public",
                roomType: rate.roomType,
                nightlyRate: rate.nightlyRate,
                totalPrice: rate.totalPrice,
                taxesAndFees: rate.taxesAndFees,
                resortFee: rate.resortFee,
                currency: rate.currency,
                sourceUrl: rate.sourceUrl,
              },
            });

            totalRatesFound++;

            // Check for price alerts
            if (previousRate && thresholds && !watchlist.alertsMuted) {
              await checkPriceAlerts(
                watchlist,
                previousRate,
                observation,
                thresholds
              );
            }
          }
        }

        await sleep(DELAY_BETWEEN_CHECKS);
      }

      // Check member rates
      if (watchlist.trackMember && cookies) {
        const result = await scrapeRates(
          property,
          range.checkIn,
          range.checkOut,
          cookies
        );

        if (!result.isLoggedIn && sessionValid) {
          // Session expired
          sessionValid = false;
          console.log("MGM session expired during check");

          await prisma.mgmSession.updateMany({
            where: { userId: watchlist.userId, isActive: true },
            data: { isActive: false, lastError: "Session expired" },
          });

          await createAlert(
            watchlist.userId,
            watchlist.id,
            "session_expired",
            "MGM Session Expired",
            "Your MGM session has expired. Please reconnect to continue receiving member rates."
          );
        }

        if (result.success && result.rates.length > 0) {
          for (const rate of result.rates) {
            const observation = await prisma.rateObservation.create({
              data: {
                watchlistId: watchlist.id,
                propertyCode: rate.propertyCode,
                propertyName: rate.propertyName,
                checkIn: rate.checkIn,
                checkOut: rate.checkOut,
                rateType: "member",
                roomType: rate.roomType,
                nightlyRate: rate.nightlyRate,
                totalPrice: rate.totalPrice,
                taxesAndFees: rate.taxesAndFees,
                resortFee: rate.resortFee,
                currency: rate.currency,
                sourceUrl: rate.sourceUrl,
              },
            });

            totalRatesFound++;

            // Check for price alerts
            if (previousRate && thresholds && !watchlist.alertsMuted) {
              await checkPriceAlerts(
                watchlist,
                previousRate,
                observation,
                thresholds
              );
            }
          }
        }

        await sleep(DELAY_BETWEEN_CHECKS);
      }
    }
  }

  // Update watchlist
  await prisma.watchlist.update({
    where: { id: watchlist.id },
    data: {
      lastCheckedAt: new Date(),
      nextCheckAt: new Date(
        Date.now() + watchlist.checkIntervalHours * 60 * 60 * 1000
      ),
    },
  });

  console.log(`Watchlist ${watchlist.id}: found ${totalRatesFound} rates`);
}

/**
 * Check if we should create a price alert
 */
async function checkPriceAlerts(
  watchlist: any,
  previousRate: any,
  currentRate: any,
  thresholds: PriceThresholds
) {
  const prevPrice = Number(previousRate.totalPrice);
  const currPrice = Number(currentRate.totalPrice);
  const percentChange = ((currPrice - prevPrice) / prevPrice) * 100;

  let shouldAlert = false;
  let alertType = "";
  let message = "";

  // Check percent drop
  if (thresholds.percentDrop && percentChange <= -thresholds.percentDrop) {
    shouldAlert = true;
    alertType = "price_drop_percent";
    message = `Price dropped ${Math.abs(percentChange).toFixed(1)}% for ${currentRate.propertyName}`;
  }

  // Check absolute threshold
  if (thresholds.absoluteBelow && currPrice <= thresholds.absoluteBelow) {
    shouldAlert = true;
    alertType = "price_below_threshold";
    message = `Price is now $${currPrice.toFixed(2)} for ${currentRate.propertyName}`;
  }

  if (shouldAlert) {
    await createAlert(
      watchlist.userId,
      watchlist.id,
      alertType,
      `Price Alert: ${currentRate.propertyName}`,
      message,
      {
        propertyCode: currentRate.propertyCode,
        propertyName: currentRate.propertyName,
        checkIn: currentRate.checkIn,
        checkOut: currentRate.checkOut,
        previousPrice: prevPrice,
        currentPrice: currPrice,
        percentChange,
      }
    );

    // Send email if enabled
    if (process.env.ENABLE_EMAIL_ALERTS === "true") {
      await sendPriceAlertEmail(
        watchlist.user.email,
        currentRate.propertyName,
        currentRate.checkIn.toLocaleDateString(),
        currentRate.checkOut.toLocaleDateString(),
        prevPrice,
        currPrice,
        percentChange
      );
    }
  }
}

/**
 * Create an alert
 */
async function createAlert(
  userId: string,
  watchlistId: string,
  alertType: string,
  title: string,
  message: string,
  extra?: any
) {
  await prisma.alert.create({
    data: {
      userId,
      watchlistId,
      alertType,
      title,
      message,
      propertyCode: extra?.propertyCode,
      propertyName: extra?.propertyName,
      checkIn: extra?.checkIn,
      checkOut: extra?.checkOut,
      previousPrice: extra?.previousPrice,
      currentPrice: extra?.currentPrice,
      percentChange: extra?.percentChange,
    },
  });
}

/**
 * Generate date ranges to check
 */
function generateDateRanges(
  dateRules: DateRules
): { checkIn: Date; checkOut: Date }[] {
  const ranges: { checkIn: Date; checkOut: Date }[] = [];

  if (dateRules.type === "specific" && dateRules.ranges) {
    for (const range of dateRules.ranges) {
      ranges.push({
        checkIn: new Date(range.checkIn),
        checkOut: new Date(range.checkOut),
      });
    }
  } else if (dateRules.type === "recurring") {
    const monthsAhead = dateRules.monthsAhead || 3;
    const nights = dateRules.nights || 2;
    const pattern = dateRules.pattern || "first-weekend";

    for (let i = 0; i < monthsAhead; i++) {
      const monthStart = startOfMonth(addMonths(new Date(), i));
      let checkIn: Date;

      switch (pattern) {
        case "first-weekend":
          checkIn = nextFriday(monthStart);
          if (checkIn.getMonth() !== monthStart.getMonth()) {
            checkIn = nextFriday(addDays(monthStart, -7));
          }
          break;
        case "last-weekend":
          const monthEnd = endOfMonth(monthStart);
          checkIn = nextFriday(addDays(monthEnd, -7));
          break;
        default:
          checkIn = nextFriday(monthStart);
      }

      ranges.push({
        checkIn,
        checkOut: addDays(checkIn, nights),
      });
    }
  }

  return ranges;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Schedule the worker
console.log("Starting Rate Robot Worker...");
console.log("Rate checks will run every 30 minutes");

// Run immediately on start
runWorker();

// Then run every 30 minutes
cron.schedule("*/30 * * * *", () => {
  runWorker();
});

// Cleanup on exit
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await closeBrowser();
  process.exit(0);
});
