import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth";
import { z } from "zod";

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

    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
