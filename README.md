# Rate Robot

Track MGM hotel room rates and get alerts when prices drop. Supports both public rates and member pricing through secure session capture.

## Features

- **Rate Tracking**: Monitor prices for multiple MGM Resorts properties
- **Member Pricing**: Connect your MGM account to see exclusive member rates
- **Price Alerts**: Get notified when prices drop below thresholds
- **Price History**: View historical rate trends with charts
- **Secure Session Storage**: Cookies encrypted with AES-256-GCM, passwords never stored
- **Scheduled Checks**: Automatic rate checking every 6 hours (configurable)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) with React
- **Database**: PostgreSQL with Prisma ORM
- **Scraping**: Playwright for browser automation
- **Styling**: Tailwind CSS with Radix UI components
- **Auth**: JWT-based with magic link option

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd RateRobot
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/rate_robot"

   # Generate with: openssl rand -base64 32
   JWT_SECRET="your-jwt-secret-here"

   # Generate with: openssl rand -hex 32
   COOKIE_ENCRYPTION_KEY="your-64-char-hex-key"

   # App URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

3. **Set up the database**:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`

## Usage

### Creating an Account

1. Go to `/auth/register`
2. Enter your email and password
3. You'll be logged in automatically

### Creating a Watchlist

1. Go to Dashboard > Watchlists > New Watchlist
2. Name your watchlist
3. Select MGM properties to track
4. Choose dates (specific or recurring pattern)
5. Set alert thresholds (optional)
6. Click "Create Watchlist"

### Connecting Your MGM Account

To see member pricing, connect your MGM account:

1. Go to "MGM Connection" in the sidebar
2. Click "Generate Connection Code"
3. Run the local connector script (see below)
4. Log in to MGM in the browser that opens
5. Your session is captured and encrypted

**Your MGM password is never stored or transmitted to Rate Robot.**

## Local Connector

The local connector runs on your machine to capture your MGM session securely:

```bash
# Generate a code in the web UI first, then:
npm run connector
```

This will:
1. Open a browser window
2. Navigate to MGM's login page
3. Wait for you to complete login (including any 2FA)
4. Capture session cookies
5. Encrypt and upload them to Rate Robot

## Running the Worker

For background rate checking, run the worker:

```bash
# Development
npm run worker

# Or trigger via cron API (for serverless):
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-rates
```

## Project Structure

```
RateRobot/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Dashboard pages
│   │   └── connect-mgm/       # MGM connection page
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   └── charts/           # Chart components
│   ├── lib/                   # Core libraries
│   │   ├── auth/             # Authentication logic
│   │   ├── db/               # Database client
│   │   ├── email/            # Email sending
│   │   ├── encryption/       # Cookie encryption
│   │   ├── scraper/          # Playwright scraping
│   │   └── worker/           # Background worker
│   └── types/                 # TypeScript types
├── prisma/                    # Database schema
├── scripts/                   # CLI scripts
│   └── local-connector.ts    # MGM session connector
├── tests/                     # Test files
│   ├── fixtures/             # HTML fixtures for testing
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
└── README.md
```

## Database Schema

```
users              - App user accounts
mgm_sessions       - Encrypted MGM session cookies
connector_codes    - One-time codes for local connector
watchlists         - Rate tracking configurations
rate_observations  - Historical rate data
alerts             - Price drop notifications
rate_check_jobs    - Job queue for scheduling
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

Tests use HTML fixtures to simulate MGM booking pages without making live requests.

## Security Considerations

- **Cookie Encryption**: Session cookies are encrypted with AES-256-GCM
- **No Password Storage**: Passwords are never stored or transmitted
- **Session Expiry**: Sessions are tracked and users prompted to reconnect
- **CSRF Protection**: App uses secure, HTTP-only cookies
- **Rate Limiting**: Scraping includes delays and jitter to avoid detection

## Rate Limiting

To respect MGM's servers:
- Minimum 3-5 seconds between requests
- Random jitter added to delays
- Concurrent request limits
- Automatic backoff on errors

## Deployment

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Set up Vercel Cron for scheduled checks:

   ```json
   // vercel.json
   {
     "crons": [{
       "path": "/api/cron/check-rates",
       "schedule": "0 */6 * * *"
     }]
   }
   ```

### Self-Hosted

1. Build: `npm run build`
2. Start: `npm start`
3. Run worker: `npm run worker`
4. Set up cron job for `/api/cron/check-rates`

## Disclaimer

**Personal Use Only**

Rate Robot is for personal, non-commercial use. It is not affiliated with or endorsed by MGM Resorts International. By using this software:

- You agree to access only your own account data
- You will use this tool responsibly
- You understand rate checking is limited to minimize server load
- You will comply with MGM's Terms of Service

## License

MIT License - see LICENSE file for details.

## Support

- Issues: https://github.com/your-repo/rate-robot/issues
- Documentation: See this README

---

Built with Next.js, Playwright, and Prisma.
