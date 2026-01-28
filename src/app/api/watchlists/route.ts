import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import type { DateRules, PriceThresholds } from "@/types";

const createWatchlistSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  properties: z.array(z.string()).min(1, "At least one property required"),
  dateRules: z.object({
    type: z.enum(["specific", "recurring"]),
    ranges: z.array(z.object({
      checkIn: z.string(),
      checkOut: z.string(),
    })).optional(),
    pattern: z.string().optional(),
    nights: z.number().optional(),
    monthsAhead: z.number().optional(),
  }),
  roomTypeFilter: z.string().optional(),
  trackMember: z.boolean().default(true),
  trackPublic: z.boolean().default(true),
  thresholds: z.object({
    percentDrop: z.number().optional(),
    absoluteBelow: z.number().optional(),
  }).optional(),
  checkIntervalHours: z.number().min(1).max(24).default(6),
});

// GET - List user's watchlists
export async function GET() {
  try {
    const user = await requireAuth();

    const watchlists = await prisma.watchlist.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        rateObservations: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            alerts: {
              where: { isRead: false },
            },
          },
        },
      },
    });

    // Transform to include parsed JSON fields
    const transformed = watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      properties: JSON.parse(w.propertiesJson) as string[],
      dateRules: JSON.parse(w.dateRulesJson) as DateRules,
      roomTypeFilter: w.roomTypeFilter,
      trackMember: w.trackMember,
      trackPublic: w.trackPublic,
      thresholds: w.thresholdsJson ? JSON.parse(w.thresholdsJson) as PriceThresholds : null,
      isActive: w.isActive,
      alertsMuted: w.alertsMuted,
      lastCheckedAt: w.lastCheckedAt,
      nextCheckAt: w.nextCheckAt,
      checkIntervalHours: w.checkIntervalHours,
      createdAt: w.createdAt,
      // Latest observation
      latestRate: w.rateObservations[0] ? {
        nightlyRate: w.rateObservations[0].nightlyRate,
        totalPrice: w.rateObservations[0].totalPrice,
        rateType: w.rateObservations[0].rateType,
        scrapedAt: w.rateObservations[0].scrapedAt,
      } : null,
      unreadAlerts: w._count.alerts,
    }));

    return NextResponse.json({
      success: true,
      watchlists: transformed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch watchlists";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

// POST - Create a new watchlist
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = createWatchlistSchema.parse(body);

    // Calculate next check time
    const nextCheckAt = new Date(Date.now() + 60 * 1000); // Check in 1 minute

    const watchlist = await prisma.watchlist.create({
      data: {
        userId: user.userId,
        name: data.name,
        propertiesJson: JSON.stringify(data.properties),
        dateRulesJson: JSON.stringify(data.dateRules),
        roomTypeFilter: data.roomTypeFilter,
        trackMember: data.trackMember,
        trackPublic: data.trackPublic,
        thresholdsJson: data.thresholds ? JSON.stringify(data.thresholds) : null,
        checkIntervalHours: data.checkIntervalHours,
        nextCheckAt,
      },
    });

    return NextResponse.json({
      success: true,
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        properties: data.properties,
        dateRules: data.dateRules,
        trackMember: watchlist.trackMember,
        trackPublic: watchlist.trackPublic,
        thresholds: data.thresholds,
        isActive: watchlist.isActive,
        nextCheckAt: watchlist.nextCheckAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create watchlist";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}
