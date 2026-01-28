import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const { userId } = await loginUser(email, password);

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
      console.error("Database error during login:", error);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // For auth errors (invalid credentials), return the message
    // These are safe messages we control from loginUser()
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
