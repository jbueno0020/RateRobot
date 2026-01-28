import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { encryptMgmSession, decryptMgmSession } from "@/lib/encryption";
import { verifySession } from "@/lib/scraper";
import type { MgmSessionData } from "@/types";

// GET - Check current MGM session status
export async function GET() {
  try {
    const user = await requireAuth();

    const session = await prisma.mgmSession.findFirst({
      where: { userId: user.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      return NextResponse.json({
        success: true,
        connected: false,
      });
    }

    // Check if session is expired
    const isExpired = session.expiresAt && session.expiresAt < new Date();

    return NextResponse.json({
      success: true,
      connected: true,
      accountMarker: session.accountMarker,
      expiresAt: session.expiresAt,
      lastVerifiedAt: session.lastVerifiedAt,
      isExpired,
      connectionMethod: session.connectionMethod,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check session";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}

// POST - Verify and refresh session
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const session = await prisma.mgmSession.findFirst({
      where: { userId: user.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No active session found" },
        { status: 404 }
      );
    }

    // Decrypt cookies
    const sessionData = decryptMgmSession<MgmSessionData>({
      encrypted: session.encryptedCookieJar,
      iv: session.encryptionIv,
      tag: session.encryptionTag,
    });

    // Verify session is still valid
    const verification = await verifySession(sessionData.cookies);

    if (!verification.valid) {
      // Mark session as inactive
      await prisma.mgmSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          lastError: verification.error,
        },
      });

      return NextResponse.json({
        success: false,
        error: verification.error || "Session expired",
        needsReconnect: true,
      });
    }

    // Update last verified time
    await prisma.mgmSession.update({
      where: { id: session.id },
      data: {
        lastVerifiedAt: new Date(),
        accountMarker: verification.accountMarker || session.accountMarker,
      },
    });

    return NextResponse.json({
      success: true,
      valid: true,
      accountMarker: verification.accountMarker,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect MGM session
export async function DELETE() {
  try {
    const user = await requireAuth();

    await prisma.mgmSession.updateMany({
      where: { userId: user.userId, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
