import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET - List user's alerts
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    const alerts = await prisma.alert.findMany({
      where: {
        userId: user.userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        watchlist: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch alerts";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

// POST - Mark alerts as read
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { alertIds, markAll } = await request.json();

    if (markAll) {
      await prisma.alert.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true },
      });
    } else if (alertIds && alertIds.length > 0) {
      await prisma.alert.updateMany({
        where: {
          id: { in: alertIds },
          userId: user.userId,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update alerts";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}
