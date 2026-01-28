import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import type { DateRules, PriceThresholds } from "@/types";

const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  properties: z.array(z.string()).min(1).optional(),
  dateRules: z.object({
    type: z.enum(["specific", "recurring"]),
    ranges: z.array(z.object({
      checkIn: z.string(),
      checkOut: z.string(),
    })).optional(),
    pattern: z.string().optional(),
    nights: z.number().optional(),
    monthsAhead: z.number().optional(),
  }).optional(),
  roomTypeFilter: z.string().optional().nullable(),
  trackMember: z.boolean().optional(),
  trackPublic: z.boolean().optional(),
  thresholds: z.object({
    percentDrop: z.number().optional(),
    absoluteBelow: z.number().optional(),
  }).optional().nullable(),
  isActive: z.boolean().optional(),
  alertsMuted: z.boolean().optional(),
  checkIntervalHours: z.number().min(1).max(24).optional(),
});

// GET - Get a specific watchlist with rate history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const watchlist = await prisma.watchlist.findFirst({
      where: {
        id,
        userId: user.userId,
      },
      include: {
        rateObservations: {
          orderBy: { scrapedAt: "desc" },
          take: 100,
        },
        alerts: {
          where: { isRead: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!watchlist) {
      return NextResponse.json(
        { success: false, error: "Watchlist not found" },
        { status: 404 }
      );
    }

    // Group observations by property and date range for price history
    const priceHistory = watchlist.rateObservations.reduce((acc, obs) => {
      const key = `${obs.propertyCode}:${obs.checkIn.toISOString()}:${obs.checkOut.toISOString()}`;
      if (!acc[key]) {
        acc[key] = {
          propertyCode: obs.propertyCode,
          propertyName: obs.propertyName,
          checkIn: obs.checkIn,
          checkOut: obs.checkOut,
          observations: [],
        };
      }
      acc[key].observations.push({
        scrapedAt: obs.scrapedAt,
        rateType: obs.rateType,
        nightlyRate: obs.nightlyRate,
        totalPrice: obs.totalPrice,
      });
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        properties: JSON.parse(watchlist.propertiesJson) as string[],
        dateRules: JSON.parse(watchlist.dateRulesJson) as DateRules,
        roomTypeFilter: watchlist.roomTypeFilter,
        trackMember: watchlist.trackMember,
        trackPublic: watchlist.trackPublic,
        thresholds: watchlist.thresholdsJson
          ? (JSON.parse(watchlist.thresholdsJson) as PriceThresholds)
          : null,
        isActive: watchlist.isActive,
        alertsMuted: watchlist.alertsMuted,
        lastCheckedAt: watchlist.lastCheckedAt,
        nextCheckAt: watchlist.nextCheckAt,
        checkIntervalHours: watchlist.checkIntervalHours,
        createdAt: watchlist.createdAt,
      },
      priceHistory: Object.values(priceHistory),
      recentAlerts: watchlist.alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch watchlist";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

// PATCH - Update a watchlist
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = updateWatchlistSchema.parse(body);

    // Verify ownership
    const existing = await prisma.watchlist.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Watchlist not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.properties !== undefined) updateData.propertiesJson = JSON.stringify(data.properties);
    if (data.dateRules !== undefined) updateData.dateRulesJson = JSON.stringify(data.dateRules);
    if (data.roomTypeFilter !== undefined) updateData.roomTypeFilter = data.roomTypeFilter;
    if (data.trackMember !== undefined) updateData.trackMember = data.trackMember;
    if (data.trackPublic !== undefined) updateData.trackPublic = data.trackPublic;
    if (data.thresholds !== undefined) {
      updateData.thresholdsJson = data.thresholds ? JSON.stringify(data.thresholds) : null;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.alertsMuted !== undefined) updateData.alertsMuted = data.alertsMuted;
    if (data.checkIntervalHours !== undefined) updateData.checkIntervalHours = data.checkIntervalHours;

    const watchlist = await prisma.watchlist.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        isActive: watchlist.isActive,
        alertsMuted: watchlist.alertsMuted,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to update watchlist";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

// DELETE - Delete a watchlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.watchlist.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Watchlist not found" },
        { status: 404 }
      );
    }

    await prisma.watchlist.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete watchlist";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}
