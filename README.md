# BLACKMIRROR™

Field inspection PWA for **BLACKBOX** / **Blackline Public Adjusters LLC**.  
Mobile-first, offline-first. Same Postgres as BLACKBOX (`Adjuster` + `Claim` + `BL-YY-####`).

## Stack

- Next.js 14 App Router, TypeScript, Tailwind
- Prisma → Supabase Postgres (shared BLACKBOX schema + inspection tables)
- NextAuth Credentials (`ADMIN` | `ADJUSTER` | `VIEWER` on `Adjuster`)
- Dexie / IndexedDB + outbox sync
- PWA service worker

## Local

Uses BLACKBOX `DATABASE_URL` / `DIRECT_URL`. Dev server is **port 3001** so it can run beside BLACKBOX.

```bash
npm install
npx prisma migrate deploy
npm run db:seed   # only if Adjuster table is empty
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Add to Home Screen on iPhone (Share → Add to Home Screen).

### Credentials (if you seeded BLACKBOX or this app)

Password: `Password123!`

| Email | Role |
|---|---|
| `miguel.fernandez@blacklineadjusting.com` | ADMIN |
| `marcus.chen@blacklineadjusting.com` | ADJUSTER |

## Capture → confirm → AI → vault

1. Shutter holds the JPEG on-device (IndexedDB). Works with no radio.
2. Confirm date, reason, and location (all required, all local).
3. If online, `/api/analyze-photo` calls Claude (`claude-sonnet-4-6`) server-side only (`ANTHROPIC_API_KEY` never ships to the client) and returns a **draft** classification plus the 3 nearest `ReferenceExample` matches (pgvector).
4. You edit the description / indicator / severity and tap **Confirm & file**. Until `adjusterConfirmed` is true, the finding does not count in the narrative or PDF.
5. Save writes the JPEG to BLACKBOX `claim-documents` at  
   `claims/{claimNumber}/{YYYY-MM-DD}_{reason}/{location}/{HHMMSS}_{description}.jpg`  
   creates a `Document` + `DocumentVaultEntry` so it shows in the claim vault, and logs AI suggestion vs adopted finding on the audit trail.

Offline photos stay `syncStatus: pending` and flush automatically when signal returns (AI + vault, still unconfirmed until you review).


1. Look up a claim by BLACKLINE number `BL-YY-####` (also accepts `BB-YYYY-####`).
2. Peril protocol loads the indicator library (water / structural / roof / interior / mechanical / exterior).
3. Mark present / not present, severity, confidence, notes (voice-to-text), photos.
4. Camera stamps GPS + timestamp into JPEG EXIF; circle/arrow overlay on the photo.
5. Generate a draft scope narrative from present indicators; edit; finalize.
6. Export a PDF with claim number, narrative, and photo grid.

Sessions live in IndexedDB. When the radio comes back, the sync bar flushes metadata + photo blobs to Prisma / Supabase Storage (`inspection-photos`). Create that bucket (public) in the Supabase dashboard, or local `public/uploads` is used when Storage is not configured.

## Schema

Additive migration: `prisma/migrations/20260828170000_inspection_module`

- `Property` — site row for a claim (GPS + address)
- `Inspection` — field session
- `InspectionItem` — checklist indicator
- `Photo` — capture + EXIF JSON + annotation JSON
# blackmirror
