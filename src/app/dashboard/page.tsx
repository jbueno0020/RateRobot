import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateRange, getPropertyName } from "@/lib/utils";
import { Plus, TrendingDown, Bell, Link as LinkIcon, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // Fetch dashboard data
  const [watchlists, alerts, mgmSession] = await Promise.all([
    prisma.watchlist.findMany({
      where: { userId: user.userId },
      include: {
        rateObservations: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.alert.findMany({
      where: { userId: user.userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.mgmSession.findFirst({
      where: { userId: user.userId, isActive: true },
    }),
  ]);

  const totalWatchlists = await prisma.watchlist.count({
    where: { userId: user.userId },
  });

  const unreadAlerts = await prisma.alert.count({
    where: { userId: user.userId, isRead: false },
  });

  // Calculate recent rate observations
  const recentObservations = await prisma.rateObservation.findMany({
    where: {
      watchlist: { userId: user.userId },
    },
    orderBy: { scrapedAt: "desc" },
    take: 10,
    include: {
      watchlist: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Track hotel rates and get alerts when prices drop
          </p>
        </div>
        <Button asChild variant="mgm">
          <Link href="/dashboard/watchlists/new">
            <Plus className="h-4 w-4 mr-2" />
            New Watchlist
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Watchlists</CardDescription>
            <CardTitle className="text-3xl">{totalWatchlists}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unread Alerts</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {unreadAlerts}
              {unreadAlerts > 0 && (
                <Bell className="h-5 w-5 text-mgm-gold" />
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MGM Connection</CardDescription>
            <CardTitle className="text-lg">
              {mgmSession ? (
                <span className="flex items-center gap-2 text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <Link
                  href="/connect-mgm"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <LinkIcon className="h-4 w-4" />
                  Connect Account
                </Link>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate Checks Today</CardDescription>
            <CardTitle className="text-3xl">{recentObservations.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* MGM Session Warning */}
      {!mgmSession && totalWatchlists > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">
                  Connect Your MGM Account
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Connect your MGM account to see member pricing. Your password is
                  never stored.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/connect-mgm">Connect Now</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Watchlists */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Watchlists</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/watchlists">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {watchlists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No watchlists yet</p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/dashboard/watchlists/new">Create Your First</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {watchlists.map((watchlist) => {
                  const properties = JSON.parse(watchlist.propertiesJson) as string[];
                  const latestRate = watchlist.rateObservations[0];

                  return (
                    <Link
                      key={watchlist.id}
                      href={`/dashboard/watchlists/${watchlist.id}`}
                      className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{watchlist.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {properties.map(getPropertyName).join(", ")}
                          </p>
                        </div>
                        {latestRate && (
                          <div className="text-right">
                            <p className="font-semibold text-mgm-gold">
                              {formatCurrency(Number(latestRate.nightlyRate))}/night
                            </p>
                            <Badge variant={latestRate.rateType === "member" ? "mgm" : "secondary"}>
                              {latestRate.rateType}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {watchlist.lastCheckedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last checked: {formatDate(watchlist.lastCheckedAt)}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alerts</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/alerts">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No alerts yet</p>
                <p className="text-sm mt-2">
                  You'll see price drop notifications here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      {alert.alertType.includes("price") ? (
                        <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(alert.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Rate Observations */}
      {recentObservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Rate Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Property</th>
                    <th className="text-left py-2">Dates</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Nightly</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2">Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {recentObservations.map((obs) => (
                    <tr key={obs.id} className="border-b last:border-0">
                      <td className="py-2">{obs.propertyName}</td>
                      <td className="py-2 text-muted-foreground">
                        {formatDateRange(obs.checkIn, obs.checkOut)}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={obs.rateType === "member" ? "mgm" : "secondary"}
                        >
                          {obs.rateType}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(Number(obs.nightlyRate))}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {formatCurrency(Number(obs.totalPrice))}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatDate(obs.scrapedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-center text-muted-foreground p-4 border rounded-lg">
        <p className="font-semibold mb-1">Personal Use Disclaimer</p>
        <p>
          Rate Robot is for personal, non-commercial use only. Not affiliated with
          MGM Resorts International. Rate checking is limited to minimize server load.
        </p>
      </div>
    </div>
  );
}
