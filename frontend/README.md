# seomcp.dev Frontend

React SPA with Clerk authentication.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Environment Variables

Create `.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://api.seomcp.dev
```

Get Clerk key from: https://dashboard.clerk.com

## Build

```bash
npm run build
```

Deploy `dist/` to Cloudflare Pages.

## Structure

- `pages/LandingPage.tsx` - Marketing site
- `pages/Dashboard.tsx` - User dashboard
- `lib/api.ts` - API client
- `main.tsx` - ClerkProvider setup
