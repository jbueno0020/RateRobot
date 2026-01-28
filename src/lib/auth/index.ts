import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateSecureToken } from "@/lib/encryption";
import type { UserSession } from "@/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-for-development-only"
);

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = "rate_robot_session";

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for user session
 */
export async function createSessionToken(
  userId: string,
  email: string
): Promise<string> {
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifySessionToken(
  token: string
): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  });
}

/**
 * Get the session cookie value
 */
export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get the current user from session
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ userId: string; token: string }> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
    },
  });

  // Create session token
  const token = await createSessionToken(user.id, user.email);
  await setSessionCookie(token);

  return { userId: user.id, token };
}

/**
 * Login user with email and password
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Create session token
  const token = await createSessionToken(user.id, user.email);
  await setSessionCookie(token);

  return { userId: user.id, token };
}

/**
 * Generate magic link for passwordless auth
 */
export async function generateMagicLink(email: string): Promise<string> {
  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Upsert user with magic link token
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      magicLinkToken: token,
      magicLinkExpires: expiresAt,
    },
    update: {
      magicLinkToken: token,
      magicLinkExpires: expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/auth/verify?token=${token}`;
}

/**
 * Verify magic link and create session
 */
export async function verifyMagicLink(
  token: string
): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.findFirst({
    where: {
      magicLinkToken: token,
      magicLinkExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error("Invalid or expired link");
  }

  // Clear magic link token and mark email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      magicLinkToken: null,
      magicLinkExpires: null,
      emailVerified: new Date(),
    },
  });

  // Create session token
  const sessionToken = await createSessionToken(user.id, user.email);
  await setSessionCookie(sessionToken);

  return { userId: user.id, token: sessionToken };
}

/**
 * Logout user
 */
export async function logoutUser(): Promise<void> {
  await clearSessionCookie();
}
