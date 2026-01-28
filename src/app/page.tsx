import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-mgm-gold">Rate</span> Robot
          </h1>
          <p className="text-xl text-muted-foreground">
            Track MGM hotel rates and get alerts when prices drop
          </p>
        </div>

        <Card className="text-left">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mgm-gold text-white flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold">Create a watchlist</h3>
                <p className="text-muted-foreground text-sm">
                  Select MGM properties and date ranges you want to track
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mgm-gold text-white flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold">Connect your MGM account (optional)</h3>
                <p className="text-muted-foreground text-sm">
                  See member pricing without storing your password
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mgm-gold text-white flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold">Get alerts when prices drop</h3>
                <p className="text-muted-foreground text-sm">
                  We check rates every 6 hours and notify you of changes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button asChild variant="mgm" size="lg">
            <Link href="/auth/register">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>

        <div className="pt-8 text-xs text-muted-foreground">
          <p className="font-semibold mb-2">Personal Use Disclaimer</p>
          <p>
            This tool is for personal, non-commercial use only. Rate Robot is not
            affiliated with MGM Resorts International. By using this service, you
            agree to use it responsibly and in accordance with MGM's Terms of Service.
            Rate checking is limited to minimize server load.
          </p>
        </div>
      </div>
    </main>
  );
}
