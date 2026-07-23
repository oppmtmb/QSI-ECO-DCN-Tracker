# QSI ECO-DCN Email Tracker

Automated change-control linking and classification tool for manufacturing quality management. Extracts ECO/DCN codes from customer and internal emails, auto-matches them, and tracks OPEN/CLOSE status in a shared ledger.

> Production Ops v1.4 — QSI Document Control & Quality Management System
> 🔗 Live app: https://qsi-eco-dcn-tracker.onrender.com/

## What it does

- Parses customer ECO announcement emails and QSI internal DCN reply emails
- Auto-extracts change-order codes: `ECO-`, `MCO-`, `AML-`, `SO-`, `ECN-`, `DCN-`, Agile PLM `N-xx-xxxx`, `PRN-`
- Auto-decodes Base64/MIME-encoded and letter-spaced pasted text before extraction
- Matches customer ECOs to internal replies using three confidence levels (L1/L2/L3)
- Maintains a live tracking ledger (OPEN/CLOSE, confidence %, flags, manual overrides)
- Exports to CSV or syncs directly to Google Sheets

Full usage and admin documentation: see `QSI_ECO-DCN_Tracker_Handbook.docx`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Express 4 (`server.ts`), served via `tsx` (dev) or bundled to `dist/server.cjs` (prod) |
| Auth | Firebase Authentication (Google sign-in, `spreadsheets` OAuth scope) |
| Data store | Google Sheets, accessed server-side via a Google service account |
| AI | `@google/genai` (Gemini API) |

There is no traditional database — the shared ledger lives in a Google Sheet, chunked as JSON across cells (see `server.ts`).

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev             # starts Express + Vite dev server on :8080
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Gemini API access |
| `APP_URL` | Yes (prod) | Public URL of the deployed app |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | For Sheets sync | Service account used to write to Google Sheets |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | For Sheets sync | Matching private key (PEM) |
| `LEDGER_SPREADSHEET_ID` | No | Overrides the default ledger spreadsheet ID |
| `PORT` | No | Defaults to `8080` (Cloud Run injects this) |
| `NODE_ENV` | No | Set to `production` to serve the built bundle and disable the debug-key endpoint |

Share the target Google Sheet with the service account's email (Editor access) before syncing.

### Build & run in production

```bash
npm run build     # vite build + esbuild bundle -> dist/server.cjs
npm start          # NODE_ENV=production node dist/server.cjs
```

Designed for Google Cloud Run: stateless, binds to `0.0.0.0`, reads `PORT` from the environment.

## Project structure

```
src/
  App.tsx                  # main app shell / state
  types.ts                 # Email, ECOMatch, SummaryStats types
  utils/
    parser.ts               # code extraction, normalization, matching engine
    firebase.ts              # Google auth + ledger save/load helpers
    defaultEmails.ts
  components/
    EmailList.tsx            # email feed sidebar
    EmailEditor.tsx           # manual entry / file upload / batch add
    TrackingTable.tsx         # ledger table with manual overrides
    RelationshipGraph.tsx     # visual trace of email matches
    SummaryCards.tsx
    CsvExporter.tsx           # CSV copy/download
    GoogleSheetsSync.tsx      # live Sheets sync panel
server.ts                  # Express API + Sheets integration
firebase-applet-config.json # Firebase client config
```

## API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ledger` | GET / POST | Read / write the shared ledger (stored in the `_LedgerState` sheet tab) |
| `/api/sheets/config` | GET | Check whether Sheets credentials are configured |
| `/api/sheets/sync` | POST | Overwrite `Sheet1` with a formatted tracking table |
| `/api/debug-key` | GET | Dev-only private-key diagnostic (disabled when `NODE_ENV=production`) |

## Notes

- Deletion of entered emails is disabled in the UI to preserve an audit trail — this is a front-end restriction only, not enforced server-side.
- Every change auto-saves to the server-side ledger and to a browser `localStorage` backup.
- See the handbook for full matching-engine logic (L1/L2/L3 confidence rules) and troubleshooting.
