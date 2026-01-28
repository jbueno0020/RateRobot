import { NextRequest, NextResponse } from "next/server";
import { generateMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const magicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = magicLinkSchema.parse(body);

    const magicLink = await generateMagicLink(email);

    // Send email (or log in development)
    const emailSent = await sendMagicLinkEmail(email, magicLink);

    if (process.env.NODE_ENV === "development") {
      console.log("Magic link:", magicLink);
    }

    return NextResponse.json({
      success: true,
      message: "Magic link sent",
      // In dev mode, return the link for testing
      ...(process.env.NODE_ENV === "development" && { magicLink }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    // Handle Prisma/database errors - don't expose internal details
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    const isDatabaseError =
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      errorMessage.includes("prisma") ||
      errorMessage.includes("database") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("connect econnrefused") ||
      errorMessage.includes("localhost:5432");

    if (isDatabaseError) {
      console.error("Database error during magic link generation:", error);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to send magic link";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
