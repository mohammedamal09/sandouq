# Sandouq — صندوق المجموعة

Mobile-first Arabic RTL group treasury PWA built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, and optional Supabase. All amounts are stored as integer centimes and displayed in MAD/DH with Western numerals.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Without Supabase variables, Sandouq opens a seeded local workspace with eight members, two admins, and three months of history. Data persists in this browser's `localStorage`. Demo admin PINs are `123456` for محمد and `654321` for أمين. These are sample credentials only; do not use them for a real group.

## Cloud setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. The schema creates private group snapshots, admin and device bindings, restricted RPCs, a private receipt bucket, and a Realtime publication.
   For an existing installation, apply [`supabase/migrations/20261101_admin_mutations.sql`](supabase/migrations/20261101_admin_mutations.sql) before deploying this release. It adds admin archive metadata and the transactional admin mutation function.
2. Enable **Anonymous Sign-Ins** under Authentication. Keep the project's service role key server-side only.
3. Copy `.env.example` to `.env.local` and fill in all three variables. Restart Next.js.
4. Open the app, create a group, and save the generated high-entropy group code. Other admins join on their phones with that code and their six-digit personal PIN. Five failed PIN attempts lock that admin's PIN for 15 minutes.

```bash
npm run build
npm start
```

Deploy to a Next.js-capable host with HTTPS. Set the same environment variables on the host. HTTPS is required for service workers on non-localhost origins. The group code and PIN hashes remain in tables that are not available through the browser Data API. Cloud mutations go through the authenticated Next.js API; the API derives the active admin from the verified device binding. The service role key must never have a `NEXT_PUBLIC_` prefix.

## Offline behavior

The app shell is cached for offline opening. Cloud mode requires one successful online group join per device. An offline edit is applied in the local view and queued in IndexedDB. Reconnect or reopen the app to replay it using its stable mutation ID. A failed edit remains pending with an error banner and retry action. Realtime refreshes other connected devices. Receipt images are held locally until they can upload to the group's private bucket.

The standalone seeded workspace and a cloud group are separate. A versioned JSON backup includes receipt images and can restore the local workspace or create a **new** cloud group. CSV export produces a ZIP containing member, payment, expense, waiver, and audit tables.

## Accounting rules

- Cash and bank balances equal cash/bank payments minus direct treasury expenses. Member-paid expenses create equal noncash contribution credits and do not affect either balance.
- Each payment is allocated to one or more months. A payment above the remaining minimum can become a current-month bonus or a prepayment across future months.
- A waiver removes that month's debt. A minimum change starts the following month and leaves historical allocations intact.
- Undo records a reversal in the audit log; it does not erase the original transaction.
- Editing or deleting a payment, waiver, or expense also retains the reversed original in the ledger. An expense paid by a member and its noncash credit are corrected together. Corrections that would leave cash or bank negative are rejected.
- Members with financial history are archived; unused members can be deleted. Admin deletion archives and revokes access while preserving historical attribution.
- Group reports never include member names. Private WhatsApp links open an editable draft in the admin's device; the admin sends it from their available WhatsApp account.

## Checks

```bash
npm test
npm run test:ui
npm run lint
npx tsc --noEmit
npm run build
```

The domain tests cover contribution states, prepayments, waiver debt, offsets, corrections, archive rules, balance reconciliation, analytics, report anonymity, and Moroccan phone normalization. Playwright uses Microsoft Edge for mobile viewport checks; set `PLAYWRIGHT_BROWSER_EXECUTABLE` if Edge is installed elsewhere. Supabase integration requires a configured project; no project credentials are included in this repository.
