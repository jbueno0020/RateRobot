"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/utils";
import { RefreshCw, TrendingDown, AlertCircle, Check, CheckCheck } from "lucide-react";

interface Alert {
  id: string;
  alertType: string;
  title: string;
  message: string;
  propertyCode: string | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  previousPrice: number | null;
  currentPrice: number | null;
  percentChange: number | null;
  isRead: boolean;
  createdAt: string;
  watchlist: {
    name: string;
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts?unread=${filter === "unread"}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertIds: string[]) => {
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds }),
      });
      setAlerts((prev) =>
        prev.map((a) =>
          alertIds.includes(a.id) ? { ...a, isRead: true } : a
        )
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;

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
          <h1 className="text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            Price drop notifications and session updates
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border rounded-lg p-1">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "unread" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </Button>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="text-lg font-semibold mb-2">No alerts yet</h3>
            <p className="text-muted-foreground">
              You'll see price drop notifications and session updates here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={!alert.isRead ? "border-mgm-gold/50 bg-mgm-gold/5" : ""}
            >
              <CardContent className="py-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {alert.alertType.includes("price") ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {alert.title}
                          {!alert.isRead && (
                            <Badge variant="mgm" className="text-xs">New</Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                      </div>

                      {alert.currentPrice && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(alert.currentPrice)}
                          </p>
                          {alert.previousPrice && (
                            <p className="text-sm text-muted-foreground line-through">
                              {formatCurrency(alert.previousPrice)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <Link
                        href={`/dashboard/watchlists`}
                        className="text-sm text-mgm-gold hover:underline"
                      >
                        {alert.watchlist.name}
                      </Link>
                      {alert.checkIn && alert.checkOut && (
                        <span className="text-sm text-muted-foreground">
                          {formatDateRange(alert.checkIn, alert.checkOut)}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(alert.createdAt)}
                      </span>
                    </div>

                    {!alert.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => markAsRead([alert.id])}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Mark as Read
                      </Button>
                    )}
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
