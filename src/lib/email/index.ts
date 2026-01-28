import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (process.env.ENABLE_EMAIL_ALERTS !== "true") {
    // Return a mock transporter for development
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transport = getTransporter();

    const result = await transport.sendMail({
      from: process.env.SMTP_FROM || "noreply@raterobot.local",
      ...options,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("Email sent (dev mode):", result);
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Sign in to Rate Robot",
    text: `Click this link to sign in to Rate Robot:\n\n${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Sign in to Rate Robot</h2>
        <p>Click the button below to sign in:</p>
        <a href="${magicLink}" style="display: inline-block; background-color: #C5A572; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Sign In
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPriceAlertEmail(
  email: string,
  propertyName: string,
  checkIn: string,
  checkOut: string,
  previousPrice: number,
  currentPrice: number,
  percentChange: number
): Promise<boolean> {
  const priceDropText =
    percentChange < 0
      ? `Price dropped ${Math.abs(percentChange).toFixed(0)}%!`
      : `Price alert`;

  return sendEmail({
    to: email,
    subject: `${priceDropText} - ${propertyName}`,
    text: `
${priceDropText}

Property: ${propertyName}
Dates: ${checkIn} to ${checkOut}
Previous: $${previousPrice.toFixed(2)}
Current: $${currentPrice.toFixed(2)}
Change: ${percentChange.toFixed(1)}%

View details in Rate Robot: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard
    `.trim(),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${priceDropText}</h2>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>${propertyName}</strong></p>
          <p style="margin: 8px 0; color: #666;">${checkIn} to ${checkOut}</p>
          <div style="display: flex; gap: 24px; margin-top: 12px;">
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Previous</p>
              <p style="margin: 0; font-size: 18px; text-decoration: line-through;">$${previousPrice.toFixed(2)}</p>
            </div>
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Current</p>
              <p style="margin: 0; font-size: 24px; color: #22c55e; font-weight: bold;">$${currentPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #C5A572; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          View in Rate Robot
        </a>
      </div>
    `,
  });
}

export async function sendSessionExpiredEmail(email: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "MGM Session Expired - Rate Robot",
    text: `
Your MGM session has expired. Member pricing is no longer available.

Please reconnect your MGM account to continue receiving member rates.

Reconnect here: ${process.env.NEXT_PUBLIC_APP_URL}/connect-mgm
    `.trim(),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">MGM Session Expired</h2>
        <p>Your MGM session has expired. Member pricing is no longer available.</p>
        <p>Please reconnect your MGM account to continue receiving member rates.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/connect-mgm" style="display: inline-block; background-color: #C5A572; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Reconnect MGM Account
        </a>
      </div>
    `,
  });
}
