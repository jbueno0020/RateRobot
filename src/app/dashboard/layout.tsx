import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Home, List, Settings, Link as LinkIcon, Bell, LogOut } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-white flex flex-col">
        <div className="p-6">
          <Link href="/dashboard" className="text-xl font-bold">
            <span className="text-mgm-gold">Rate</span> Robot
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/watchlists"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <List className="h-5 w-5" />
            Watchlists
          </Link>
          <Link
            href="/dashboard/alerts"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Bell className="h-5 w-5" />
            Alerts
          </Link>
          <Link
            href="/connect-mgm"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <LinkIcon className="h-5 w-5" />
            MGM Connection
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-400">
            <div className="flex-1 truncate">{user.email}</div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
