"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, formatDate, getPropertyName } from "@/lib/utils";
import { Plus, RefreshCw, Trash2, BellOff, Bell, Play } from "lucide-react";

interface Watchlist {
  id: string;
  name: string;
  properties: string[];
  trackMember: boolean;
  trackPublic: boolean;
  isActive: boolean;
  alertsMuted: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  checkIntervalHours: number;
  latestRate: {
    nightlyRate: number;
    totalPrice: number;
    rateType: string;
    scrapedAt: string;
  } | null;
  unreadAlerts: number;
}

export default function WatchlistsPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const fetchWatchlists = async () => {
    try {
      const res = await fetch("/api/watchlists");
      const data = await res.json();
      if (data.success) {
        setWatchlists(data.watchlists);
      }
    } catch (error) {
      console.error("Failed to fetch watchlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/watchlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      setWatchlists((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isActive } : w))
      );
    } catch (error) {
      console.error("Failed to update watchlist:", error);
    }
  };

  const toggleAlerts = async (id: string, alertsMuted: boolean) => {
    try {
      await fetch(`/api/watchlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertsMuted }),
      });
      setWatchlists((prev) =>
        prev.map((w) => (w.id === id ? { ...w, alertsMuted } : w))
      );
    } catch (error) {
      console.error("Failed to update watchlist:", error);
    }
  };

  const deleteWatchlist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this watchlist?")) return;

    try {
      await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error("Failed to delete watchlist:", error);
    }
  };

  const checkRates = async (id: string) => {
    setCheckingId(id);
    try {
      await fetch("/api/rates/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistId: id }),
      });
      await fetchWatchlists();
    } catch (error) {
      console.error("Failed to check rates:", error);
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Watchlists</h1>
          <p className="text-muted-foreground">
            Manage your hotel rate tracking watchlists
          </p>
        </div>
        <Button asChild variant="mgm">
          <Link href="/dashboard/watchlists/new">
            <Plus className="h-4 w-4 mr-2" />
            New Watchlist
          </Link>
        </Button>
      </div>

      {watchlists.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="text-lg font-semibold mb-2">No watchlists yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a watchlist to start tracking hotel rates
            </p>
            <Button asChild variant="mgm">
              <Link href="/dashboard/watchlists/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Watchlist
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {watchlists.map((watchlist) => (
            <Card key={watchlist.id} className={!watchlist.isActive ? "opacity-60" : ""}>
              <CardContent className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/watchlists/${watchlist.id}`}
                        className="text-lg font-semibold hover:text-mgm-gold"
                      >
                        {watchlist.name}
                      </Link>
                      {watchlist.unreadAlerts > 0 && (
                        <Badge variant="destructive">
                          {watchlist.unreadAlerts} alerts
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {watchlist.properties.map(getPropertyName).join(", ")}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {watchlist.trackMember && (
                        <Badge variant="mgm">Member</Badge>
                      )}
                      {watchlist.trackPublic && (
                        <Badge variant="secondary">Public</Badge>
                      )}
                      <span>Every {watchlist.checkIntervalHours}h</span>
                      {watchlist.lastCheckedAt && (
                        <span>
                          Last: {formatDate(watchlist.lastCheckedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {watchlist.latestRate && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-mgm-gold">
                        {formatCurrency(watchlist.latestRate.nightlyRate)}
                      </p>
                      <p className="text-sm text-muted-foreground">/night</p>
                      <Badge
                        variant={
                          watchlist.latestRate.rateType === "member"
                            ? "mgm"
                            : "secondary"
                        }
                        className="mt-1"
                      >
                        {watchlist.latestRate.rateType}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={watchlist.isActive}
                        onCheckedChange={(checked) =>
                          toggleActive(watchlist.id, checked)
                        }
                      />
                      Active
                    </label>
                    <button
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        toggleAlerts(watchlist.id, !watchlist.alertsMuted)
                      }
                    >
                      {watchlist.alertsMuted ? (
                        <>
                          <BellOff className="h-4 w-4" />
                          Alerts Muted
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4" />
                          Alerts On
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkRates(watchlist.id)}
                      disabled={checkingId === watchlist.id}
                    >
                      {checkingId === watchlist.id ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Check Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteWatchlist(watchlist.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
