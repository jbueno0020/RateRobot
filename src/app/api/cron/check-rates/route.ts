import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptMgmSession } from "@/lib/encryption";
import { scrapeRates, closeBrowser } from "@/lib/scraper";
import { addDays, addMonths, startOfMonth, nextFriday, endOfMonth } from "date-fns";
import type { MgmSessionData, DateRules } from "@/types";

// This route can be called by Vercel Cron, GitHub Actions, etc.
// Add a secret token for security

const CRON_SECRET = process.env.CRON_SECRET || "development";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(`[${new Date().toISOString()}] Cron: Starting rate check...`);

    // Find watchlists that need checking
    const watchlists = await prisma.watchlist.findMany({
      where: {
        isActive: true,
        nextCheckAt: {
          lte: new Date(),
        },
      },
      take: 5, // Limit to 5 per cron run to stay within timeout
    });

    console.log(`Found ${watchlists.length} watchlists to check`);

    let totalRatesFound = 0;

    for (const watchlist of watchlists) {
      try {
        const rates = await checkWatchlist(watchlist);
        totalRatesFound += rates;

        // Update next check time
        await prisma.watchlist.update({
          where: { id: watchlist.id },
          data: {
            lastCheckedAt: new Date(),
            nextCheckAt: new Date(
              Date.now() + watchlist.checkIntervalHours * 60 * 60 * 1000
            ),
          },
        });
      } catch (error) {
        console.error(`Error checking watchlist ${watchlist.id}:`, error);
      }
    }

    // Cleanup
    await closeBrowser();

    return NextResponse.json({
      success: true,
      watchlistsChecked: watchlists.length,
      ratesFound: totalRatesFound,
    });
  } catch (error) {
    console.error("Cron error:", error);
    await closeBrowser();
    return NextResponse.json(
      { error: "Rate check failed" },
      { status: 500 }
    );
  }
}

async function checkWatchlist(watchlist: any): Promise<number> {
  // Get cookies if tracking member rates
  let cookies: any[] | undefined;

  if (watchlist.trackMember) {
    const session = await prisma.mgmSession.findFirst({
      where: { userId: watchlist.userId, isActive: true },
    });

    if (session) {
      try {
        const data = decryptMgmSession<MgmSessionData>({
          encrypted: session.encryptedCookieJar,
          iv: session.encryptionIv,
          tag: session.encryptionTag,
        });
        cookies = data.cookies;
      } catch (e) {
        console.error("Decrypt failed:", e);
      }
    }
  }

  const properties = JSON.parse(watchlist.propertiesJson) as string[];
  const dateRules = JSON.parse(watchlist.dateRulesJson) as DateRules;
  const dateRanges = generateDateRanges(dateRules);

  let ratesFound = 0;

  for (const property of properties) {
    for (const range of dateRanges) {
      // Public rates
      if (watchlist.trackPublic) {
        const result = await scrapeRates(property, range.checkIn, range.checkOut);
        if (result.success) {
          for (const rate of result.rates) {
            await prisma.rateObservation.create({
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
                currency: rate.currency,
                sourceUrl: rate.sourceUrl,
              },
            });
            ratesFound++;
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Member rates
      if (watchlist.trackMember && cookies) {
        const result = await scrapeRates(property, range.checkIn, range.checkOut, cookies);
        if (result.success) {
          for (const rate of result.rates) {
            await prisma.rateObservation.create({
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
                currency: rate.currency,
                sourceUrl: rate.sourceUrl,
              },
            });
            ratesFound++;
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  return ratesFound;
}

function generateDateRanges(dateRules: DateRules): { checkIn: Date; checkOut: Date }[] {
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

    for (let i = 0; i < monthsAhead; i++) {
      const monthStart = startOfMonth(addMonths(new Date(), i));
      const checkIn = nextFriday(monthStart);
      ranges.push({
        checkIn,
        checkOut: addDays(checkIn, nights),
      });
    }
  }

  return ranges;
}
