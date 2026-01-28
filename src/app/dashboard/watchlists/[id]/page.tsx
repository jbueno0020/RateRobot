"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateRange, getPropertyName } from "@/lib/utils";
import { ArrowLeft, RefreshCw, Play, TrendingDown, TrendingUp } from "lucide-react";
import { PriceHistoryChart } from "@/components/charts/price-history";

interface WatchlistDetail {
  id: string;
  name: string;
  properties: string[];
  dateRules: any;
  trackMember: boolean;
  trackPublic: boolean;
  thresholds: any;
  isActive: boolean;
  alertsMuted: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  checkIntervalHours: number;
}

interface PriceHistory {
  propertyCode: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  observations: {
    scrapedAt: string;
    rateType: string;
    nightlyRate: number;
    totalPrice: number;
  }[];
}

interface Alert {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  alertType: string;
}

export default function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchlistDetail | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchWatchlist();
  }, [resolvedParams.id]);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`/api/watchlists/${resolvedParams.id}`);
      if (res.status === 404) {
        router.push("/dashboard/watchlists");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setWatchlist(data.watchlist);
        setPriceHistory(data.priceHistory);
        setAlerts(data.recentAlerts);
      }
    } catch (error) {
      console.error("Failed to fetch watchlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkRates = async () => {
    setChecking(true);
    try {
      await fetch("/api/rates/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistId: resolvedParams.id }),
      });
      await fetchWatchlist();
    } catch (error) {
      console.error("Failed to check rates:", error);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!watchlist) {
    return null;
  }

  // Calculate price trends
  const calculateTrend = (history: PriceHistory) => {
    const memberObs = history.observations.filter((o) => o.rateType === "member");
    if (memberObs.length < 2) return null;

    const latest = memberObs[0].totalPrice;
    const previous = memberObs[1].totalPrice;
    const change = ((latest - previous) / previous) * 100;
    return {
      change,
      latest,
      previous,
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/watchlists">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{watchlist.name}</h1>
            <p className="text-muted-foreground">
              {watchlist.properties.map(getPropertyName).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={checkRates}
            disabled={checking}
          >
            {checking ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Check Rates Now
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-lg">
              <Badge variant={watchlist.isActive ? "success" : "secondary"}>
                {watchlist.isActive ? "Active" : "Paused"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate Types</CardDescription>
            <CardTitle className="text-lg flex gap-2">
              {watchlist.trackMember && <Badge variant="mgm">Member</Badge>}
              {watchlist.trackPublic && <Badge variant="secondary">Public</Badge>}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Checked</CardDescription>
            <CardTitle className="text-lg">
              {watchlist.lastCheckedAt
                ? formatDate(watchlist.lastCheckedAt)
                : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Check Interval</CardDescription>
            <CardTitle className="text-lg">
              Every {watchlist.checkIntervalHours} hours
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Price History by Property/Date */}
      {priceHistory.length > 0 ? (
        <div className="space-y-6">
          {priceHistory.map((history, idx) => {
            const trend = calculateTrend(history);

            return (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{history.propertyName}</CardTitle>
                      <CardDescription>
                        {formatDateRange(history.checkIn, history.checkOut)}
                      </CardDescription>
                    </div>
                    {trend && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {formatCurrency(trend.latest)}
                        </p>
                        <p
                          className={`flex items-center gap-1 text-sm ${
                            trend.change < 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {trend.change < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {Math.abs(trend.change).toFixed(1)}% from last check
                        </p>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <PriceHistoryChart observations={history.observations} />

                  {/* Rate Table */}
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold mb-3">Rate History</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Date</th>
                            <th className="text-left py-2">Type</th>
                            <th className="text-right py-2">Nightly</th>
                            <th className="text-right py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.observations.slice(0, 10).map((obs, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2">
                                {formatDate(obs.scrapedAt)}
                              </td>
                              <td className="py-2">
                                <Badge
                                  variant={
                                    obs.rateType === "member"
                                      ? "mgm"
                                      : "secondary"
                                  }
                                >
                                  {obs.rateType}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">
                                {formatCurrency(obs.nightlyRate)}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {formatCurrency(obs.totalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="text-lg font-semibold mb-2">No rate data yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Check Rates Now" to fetch current rates
            </p>
            <Button onClick={checkRates} disabled={checking} variant="mgm">
              {checking ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Check Rates
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(alert.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
