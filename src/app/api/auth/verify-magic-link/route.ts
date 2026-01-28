import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const verifySchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = verifySchema.parse(body);

    const { userId } = await verifyMagicLink(token);

    return NextResponse.json({
      success: true,
      userId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    // Handle Prisma/database errors - don't expose internal details
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Error && error.message.includes("prisma"))
    ) {
      console.error("Database error during magic link verification:", error);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // For known verification errors (e.g., "Invalid or expired link")
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
