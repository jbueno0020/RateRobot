"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setError("Missing verification token");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/auth/verify-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Verification failed");
        }

        setStatus("success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Verification failed");
      }
    };

    verifyToken();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "verifying" && (
            <>
              <CardTitle>Verifying...</CardTitle>
              <CardDescription>Please wait while we verify your link</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <CardTitle className="text-green-600">Success!</CardTitle>
              <CardDescription>Redirecting to dashboard...</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <CardTitle className="text-red-600">Verification Failed</CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          )}
        </CardHeader>
        {status === "error" && (
          <CardContent className="flex justify-center">
            <Button asChild variant="mgm">
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
