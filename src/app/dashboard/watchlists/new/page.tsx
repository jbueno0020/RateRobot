"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MGM_PROPERTIES } from "@/types";
import { ArrowLeft } from "lucide-react";

export default function NewWatchlistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [dateType, setDateType] = useState<"specific" | "recurring">("specific");

  // Specific dates
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  // Recurring
  const [pattern, setPattern] = useState("first-weekend");
  const [nights, setNights] = useState(2);
  const [monthsAhead, setMonthsAhead] = useState(3);

  // Rate tracking
  const [trackMember, setTrackMember] = useState(true);
  const [trackPublic, setTrackPublic] = useState(true);

  // Thresholds
  const [percentDrop, setPercentDrop] = useState<number | undefined>();
  const [absoluteBelow, setAbsoluteBelow] = useState<number | undefined>();

  const [checkInterval, setCheckInterval] = useState(6);

  const toggleProperty = (code: string) => {
    setSelectedProperties((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (selectedProperties.length === 0) {
      setError("Please select at least one property");
      setLoading(false);
      return;
    }

    if (dateType === "specific" && (!checkIn || !checkOut)) {
      setError("Please enter check-in and check-out dates");
      setLoading(false);
      return;
    }

    try {
      const dateRules =
        dateType === "specific"
          ? {
              type: "specific" as const,
              ranges: [{ checkIn, checkOut }],
            }
          : {
              type: "recurring" as const,
              pattern,
              nights,
              monthsAhead,
            };

      const thresholds =
        percentDrop || absoluteBelow
          ? {
              percentDrop,
              absoluteBelow,
            }
          : undefined;

      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          properties: selectedProperties,
          dateRules,
          trackMember,
          trackPublic,
          thresholds,
          checkIntervalHours: checkInterval,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create watchlist");
      }

      router.push(`/dashboard/watchlists/${data.watchlist.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/watchlists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Watchlist</h1>
          <p className="text-muted-foreground">
            Track rates for your selected properties and dates
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {/* Name */}
        <Card>
          <CardHeader>
            <CardTitle>Watchlist Name</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="e.g., Vegas Weekend Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </CardContent>
        </Card>

        {/* Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Select Properties</CardTitle>
            <CardDescription>
              Choose which MGM properties to track
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {MGM_PROPERTIES.map((property) => (
                <label
                  key={property.code}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedProperties.includes(property.code)
                      ? "bg-mgm-gold/10 border-mgm-gold"
                      : "hover:bg-muted"
                  }`}
                >
                  <Checkbox
                    checked={selectedProperties.includes(property.code)}
                    onCheckedChange={() => toggleProperty(property.code)}
                  />
                  <div>
                    <p className="font-medium">{property.shortName}</p>
                    <p className="text-xs text-muted-foreground">
                      {property.location}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Date Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Date Selection</CardTitle>
            <CardDescription>
              Choose specific dates or set up recurring tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dateType"
                  checked={dateType === "specific"}
                  onChange={() => setDateType("specific")}
                  className="w-4 h-4"
                />
                Specific Dates
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dateType"
                  checked={dateType === "recurring"}
                  onChange={() => setDateType("recurring")}
                  className="w-4 h-4"
                />
                Recurring
              </label>
            </div>

            {dateType === "specific" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    min={checkIn || new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Pattern</Label>
                  <Select value={pattern} onValueChange={setPattern}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first-weekend">First Weekend of Each Month</SelectItem>
                      <SelectItem value="last-weekend">Last Weekend of Each Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Number of Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={nights}
                      onChange={(e) => setNights(parseInt(e.target.value) || 2)}
                    />
                  </div>
                  <div>
                    <Label>Months Ahead</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={monthsAhead}
                      onChange={(e) => setMonthsAhead(parseInt(e.target.value) || 3)}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rate Types */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Types</CardTitle>
            <CardDescription>
              Choose which rate types to track
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium">Member Rates</p>
                <p className="text-sm text-muted-foreground">
                  Requires MGM account connection
                </p>
              </div>
              <Switch
                checked={trackMember}
                onCheckedChange={setTrackMember}
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium">Public Rates</p>
                <p className="text-sm text-muted-foreground">
                  Standard rates without login
                </p>
              </div>
              <Switch
                checked={trackPublic}
                onCheckedChange={setTrackPublic}
              />
            </label>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds (Optional)</CardTitle>
            <CardDescription>
              Get notified when prices meet these conditions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Alert when price drops by (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="e.g., 10"
                value={percentDrop || ""}
                onChange={(e) =>
                  setPercentDrop(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
              />
            </div>
            <div>
              <Label>Alert when price is below ($)</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g., 150"
                value={absoluteBelow || ""}
                onChange={(e) =>
                  setAbsoluteBelow(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Check Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>Check Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={checkInterval.toString()}
              onValueChange={(v) => setCheckInterval(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every hour</SelectItem>
                <SelectItem value="3">Every 3 hours</SelectItem>
                <SelectItem value="6">Every 6 hours</SelectItem>
                <SelectItem value="12">Every 12 hours</SelectItem>
                <SelectItem value="24">Once daily</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" variant="mgm" disabled={loading}>
            {loading ? "Creating..." : "Create Watchlist"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/watchlists">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
