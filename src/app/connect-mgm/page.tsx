"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, RefreshCw } from "lucide-react";

interface SessionStatus {
  connected: boolean;
  accountMarker?: string;
  expiresAt?: string;
  isExpired?: boolean;
  connectionMethod?: string;
}

export default function ConnectMgmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectorCode, setConnectorCode] = useState<string | null>(null);
  const [codeExpires, setCodeExpires] = useState<Date | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/mgm-session");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error("Failed to check status:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    try {
      const res = await fetch("/api/mgm-session/connector-code", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setConnectorCode(data.code);
        setCodeExpires(new Date(data.expiresAt));
      }
    } catch (error) {
      console.error("Failed to generate code:", error);
    }
  };

  const verifySession = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/mgm-session", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await checkStatus();
      }
    } catch (error) {
      console.error("Failed to verify session:", error);
    } finally {
      setVerifying(false);
    }
  };

  const disconnectSession = async () => {
    try {
      const res = await fetch("/api/mgm-session", {
        method: "DELETE",
      });
      if (res.ok) {
        setStatus({ connected: false });
        setConnectorCode(null);
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const copyCode = () => {
    if (connectorCode) {
      navigator.clipboard.writeText(connectorCode);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Connect MGM Account</h1>
            <p className="text-muted-foreground">
              Access member pricing without storing your password
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connection Status
              {status?.connected && !status.isExpired && (
                <Badge variant="success">Connected</Badge>
              )}
              {status?.connected && status.isExpired && (
                <Badge variant="warning">Expired</Badge>
              )}
              {!status?.connected && (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  {status.isExpired ? (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <span>
                    {status.accountMarker || "MGM Account"} via{" "}
                    {status.connectionMethod === "local_connector"
                      ? "Local Connector"
                      : "Interactive Login"}
                  </span>
                </div>
                {status.expiresAt && (
                  <p className="text-sm text-muted-foreground">
                    {status.isExpired ? "Expired" : "Expires"}:{" "}
                    {new Date(status.expiresAt).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={verifySession}
                    disabled={verifying}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${verifying ? "animate-spin" : ""}`} />
                    Verify Session
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={disconnectSession}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Connect your MGM account to see member pricing in your rate tracking.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Local Connector */}
        <Card>
          <CardHeader>
            <CardTitle>Local Connector</CardTitle>
            <CardDescription>
              Run a script on your computer to securely connect your MGM session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold">How it works:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Generate a one-time code below</li>
                <li>Run the connector script on your computer</li>
                <li>Log in to MGM in the browser that opens</li>
                <li>The script captures your session cookies (not your password)</li>
                <li>Session is encrypted and uploaded to Rate Robot</li>
              </ol>
            </div>

            {connectorCode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Code</p>
                    <p className="text-3xl font-mono font-bold tracking-widest">
                      {connectorCode}
                    </p>
                  </div>
                  <Button variant="outline" size="icon" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {codeExpires && (
                  <p className="text-sm text-muted-foreground text-center">
                    Code expires at {codeExpires.toLocaleTimeString()}
                  </p>
                )}
                <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg">
                  <p className="text-xs text-zinc-400 mb-2">Run in terminal:</p>
                  <code className="text-sm">npm run connector</code>
                </div>
              </div>
            ) : (
              <Button onClick={generateCode} variant="mgm">
                Generate Connection Code
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card>
          <CardHeader>
            <CardTitle>Security Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Your MGM password is never stored.</strong> We only store
              encrypted session cookies that expire automatically.
            </p>
            <p>
              Session cookies are encrypted with AES-256-GCM before storage.
              Only Rate Robot can decrypt them, and they're only used to check
              member pricing.
            </p>
            <p>
              If MGM requires re-authentication (2FA, security check), your
              session will expire and you'll need to reconnect.
            </p>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="text-xs text-center text-muted-foreground p-4 border rounded-lg">
          <p className="font-semibold mb-2">Personal Use Disclaimer</p>
          <p>
            This feature is for personal, non-commercial use only. By connecting
            your MGM account, you acknowledge that you are accessing your own
            account data and will use this tool responsibly.
          </p>
        </div>
      </div>
    </main>
  );
}
