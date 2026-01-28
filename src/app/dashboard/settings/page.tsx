"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [emailAlerts, setEmailAlerts] = useState(false);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and notification preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how you receive alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Always enabled - see alerts in the dashboard
              </p>
            </div>
            <Switch checked={true} disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive price alerts via email
              </p>
            </div>
            <Switch
              checked={emailAlerts}
              onCheckedChange={setEmailAlerts}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Checking</CardTitle>
          <CardDescription>
            Understand how Rate Robot checks prices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Rate Robot checks prices for your watchlists based on the interval
            you set for each one (default: every 6 hours).
          </p>
          <p>
            To respect MGM's servers and avoid detection, we add random delays
            between requests and limit concurrent checks.
          </p>
          <p>
            If your MGM session expires, you'll see an alert and can reconnect
            via the MGM Connection page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Rate History</p>
              <p className="text-sm text-muted-foreground">
                Download your rate observations as CSV
              </p>
            </div>
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">Personal Use Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Rate Robot is for personal, non-commercial use only. This service is
            not affiliated with or endorsed by MGM Resorts International.
          </p>
          <p className="mt-2">
            By using Rate Robot, you agree to access only your own account data
            and use this tool responsibly in accordance with MGM's Terms of
            Service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
