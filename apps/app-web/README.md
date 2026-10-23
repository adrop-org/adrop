# app-web

The Adrop console (`app.adrop.sh`): advertisers push a campaign into every app in the network; `/play` shows the
player side on a small game screen. Next 14, port 3002. Reads `GET /stats`, `GET /campaigns`, `GET /campaigns/:id/activity`
from the server and falls back to sample rows (marked "sample") when the API does not answer within 3 s.

```sh
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_HOST_ATA, NEXT_PUBLIC_APP_URL
pnpm dev                     # http://localhost:3002
```

Design tokens live in `app/globals.css` (brand: `docs/brand/README.md`). The fallback recording for the offline card goes to
`public/rome-fallback.mp4` (not in git).
