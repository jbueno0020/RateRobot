import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = registerSchema.parse(body);

    const { userId } = await registerUser(email, password);

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
      console.error("Database error during registration:", error);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // For known registration errors (e.g., "Email already registered")
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
