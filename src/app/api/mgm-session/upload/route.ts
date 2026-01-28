import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptMgmSession } from "@/lib/encryption";
import { z } from "zod";
import type { MgmSessionData } from "@/types";

const uploadSchema = z.object({
  code: z.string().length(6, "Invalid code"),
  sessionData: z.object({
    cookies: z.array(z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
      path: z.string(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
    })),
    capturedAt: z.string(),
    userAgent: z.string(),
    accountMarker: z.string().optional(),
  }),
});

// POST - Upload session from local connector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, sessionData } = uploadSchema.parse(body);

    // Find and validate the connector code
    const connectorCode = await prisma.connectorCode.findFirst({
      where: {
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!connectorCode) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Mark code as used
    await prisma.connectorCode.update({
      where: { id: connectorCode.id },
      data: { used: true },
    });

    // Deactivate any existing sessions
    await prisma.mgmSession.updateMany({
      where: { userId: connectorCode.userId, isActive: true },
      data: { isActive: false },
    });

    // Encrypt the session data
    const encrypted = encryptMgmSession(sessionData);

    // Calculate expiry (assume 7 days from now, but check cookie expiry)
    let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionCookies = sessionData.cookies.filter(
      (c) => c.name.toLowerCase().includes("session") || c.name.toLowerCase().includes("auth")
    );
    if (sessionCookies.length > 0) {
      const minExpiry = Math.min(...sessionCookies.filter((c) => c.expires).map((c) => c.expires!));
      if (minExpiry > 0) {
        expiresAt = new Date(minExpiry * 1000);
      }
    }

    // Create new session
    await prisma.mgmSession.create({
      data: {
        userId: connectorCode.userId,
        encryptedCookieJar: encrypted.encrypted,
        encryptionIv: encrypted.iv,
        encryptionTag: encrypted.tag,
        accountMarker: sessionData.accountMarker,
        expiresAt,
        lastVerifiedAt: new Date(),
        connectionMethod: "local_connector",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Session connected successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid session data format" },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to upload session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
