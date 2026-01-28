import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { decryptMgmSession } from "@/lib/encryption";
import { scrapeRates } from "@/lib/scraper";
import type { MgmSessionData, DateRules, SpecificDateRange } from "@/types";
import { addMonths, startOfMonth, endOfMonth, nextFriday, addDays, format } from "date-fns";

// POST - Trigger a manual rate check for a watchlist
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { watchlistId } = await request.json();

    if (!watchlistId) {
      return NextResponse.json(
        { success: false, error: "watchlistId is required" },
        { status: 400 }
      );
    }

    // Get watchlist
    const watchlist = await prisma.watchlist.findFirst({
      where: {
        id: watchlistId,
        userId: user.userId,
      },
    });

    if (!watchlist) {
      return NextResponse.json(
        { success: false, error: "Watchlist not found" },
        { status: 404 }
      );
    }

    // Get MGM session if user wants member rates
    let cookies: any[] | undefined;
    if (watchlist.trackMember) {
      const mgmSession = await prisma.mgmSession.findFirst({
        where: { userId: user.userId, isActive: true },
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
        }
      }
    }

    // Parse watchlist config
    const properties = JSON.parse(watchlist.propertiesJson) as string[];
    const dateRules = JSON.parse(watchlist.dateRulesJson) as DateRules;

    // Generate date ranges to check
    const dateRanges = generateDateRanges(dateRules);

    // Check rates for each property and date range
    const results: any[] = [];
    let totalRatesFound = 0;

    for (const property of properties) {
      for (const range of dateRanges) {
        // Check public rates
        if (watchlist.trackPublic) {
          const publicResult = await scrapeRates(
            property,
            range.checkIn,
            range.checkOut,
            undefined // No cookies for public rate
          );

          if (publicResult.success && publicResult.rates.length > 0) {
            for (const rate of publicResult.rates) {
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
                  resortFee: rate.resortFee,
                  currency: rate.currency,
                  sourceUrl: rate.sourceUrl,
                  rawJson: rate.rawJson,
                },
              });
              totalRatesFound++;
            }
            results.push({
              property,
              checkIn: range.checkIn,
              checkOut: range.checkOut,
              type: "public",
              rates: publicResult.rates.length,
            });
          }
        }

        // Check member rates if we have a session
        if (watchlist.trackMember && cookies) {
          // Add delay between requests
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const memberResult = await scrapeRates(
            property,
            range.checkIn,
            range.checkOut,
            cookies
          );

          if (memberResult.success && memberResult.rates.length > 0) {
            for (const rate of memberResult.rates) {
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
                  resortFee: rate.resortFee,
                  currency: rate.currency,
                  sourceUrl: rate.sourceUrl,
                  rawJson: rate.rawJson,
                },
              });
              totalRatesFound++;
            }
            results.push({
              property,
              checkIn: range.checkIn,
              checkOut: range.checkOut,
              type: "member",
              rates: memberResult.rates.length,
            });
          }
        }

        // Add delay between properties
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Update watchlist
    await prisma.watchlist.update({
      where: { id: watchlist.id },
      data: {
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + watchlist.checkIntervalHours * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      ratesFound: totalRatesFound,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rate check failed";
    console.error("Rate check error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

/**
 * Generate date ranges to check based on date rules
 */
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
    const pattern = dateRules.pattern || "first-weekend";

    for (let i = 0; i < monthsAhead; i++) {
      const monthStart = startOfMonth(addMonths(new Date(), i));

      let checkIn: Date;

      switch (pattern) {
        case "first-weekend":
          // First Friday of the month
          checkIn = nextFriday(monthStart);
          if (checkIn.getMonth() !== monthStart.getMonth()) {
            checkIn = nextFriday(addDays(monthStart, -7));
          }
          break;
        case "last-weekend":
          // Last Friday of the month
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
