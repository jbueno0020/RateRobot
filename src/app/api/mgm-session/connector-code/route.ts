import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateConnectorCode } from "@/lib/encryption";

// POST - Generate a one-time connector code for local connector script
export async function POST() {
  try {
    const user = await requireAuth();

    // Invalidate any existing unused codes
    await prisma.connectorCode.updateMany({
      where: {
        userId: user.userId,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate new code
    const code = generateConnectorCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.connectorCode.create({
      data: {
        userId: user.userId,
        code,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      code,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate code";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message === "Authentication required" ? 401 : 500 }
    );
  }
}
