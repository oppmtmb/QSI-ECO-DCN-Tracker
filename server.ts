import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

const app = express();
// Cloud Run injects PORT automatically (usually 8080). Fall back to 8080 for local/dev parity.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

app.use(express.json({ limit: '10mb' }));

// Helpers to clean up environment variables and handle potential user paste typos
function cleanServiceAccountEmail(rawEmail: string | undefined): string | undefined {
  if (!rawEmail) return undefined;
  // If they pasted a whole JSON by mistake, parse and extract client_email
  try {
    const trimmed = rawEmail.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.client_email) {
        return parsed.client_email;
      }
    }
  } catch (e) {}

  // Match standard email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = rawEmail.match(emailRegex);
  if (match) {
    return match[0];
  }
  return rawEmail.trim();
}

function cleanPrivateKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) {
    console.log("[cleanPrivateKey] rawKey is undefined or empty");
    return undefined;
  }

  let key = rawKey.trim();
  console.log(`[cleanPrivateKey] Input key length: ${key.length}`);
  console.log(`[cleanPrivateKey] Input starts with: "${key.substring(0, 30)}..."`);
  console.log(`[cleanPrivateKey] Input ends with: "...${key.substring(Math.max(0, key.length - 30))}"`);
  console.log(`[cleanPrivateKey] Input contains '\\n' (escaped): ${key.includes('\\n')}`);
  console.log(`[cleanPrivateKey] Input contains actual newlines: ${key.includes('\n')}`);

  // If they pasted a whole JSON by mistake, parse and extract private_key
  try {
    if (key.startsWith('{')) {
      console.log("[cleanPrivateKey] Key starts with '{', attempting to parse as JSON...");
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        key = parsed.private_key;
        console.log(`[cleanPrivateKey] Successfully extracted private_key from JSON. New length: ${key.length}`);
      }
    }
  } catch (e: any) {
    console.log(`[cleanPrivateKey] JSON parsing failed: ${e.message}`);
  }

  // Repeatedly clean up enclosing quotes, trailing commas, and whitespace
  let prevKey = "";
  while (key !== prevKey) {
    prevKey = key;
    key = key.trim();

    // Remove leading/trailing matching quotes
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.substring(1, key.length - 1);
      console.log(`[cleanPrivateKey] Stripped matching double quotes. New length: ${key.length}`);
      continue;
    }
    if (key.startsWith("'") && key.endsWith("'")) {
      key = key.substring(1, key.length - 1);
      console.log(`[cleanPrivateKey] Stripped matching single quotes. New length: ${key.length}`);
      continue;
    }

    // Remove trailing comma (often copied from JSON)
    if (key.endsWith(',')) {
      key = key.substring(0, key.length - 1).trim();
      console.log(`[cleanPrivateKey] Stripped trailing comma. New length: ${key.length}`);
      continue;
    }

    // Remove unmatched leading quotes
    if (key.startsWith('"')) {
      key = key.substring(1);
      console.log(`[cleanPrivateKey] Stripped unmatched leading double quote. New length: ${key.length}`);
      continue;
    }
    if (key.startsWith("'")) {
      key = key.substring(1);
      console.log(`[cleanPrivateKey] Stripped unmatched leading single quote. New length: ${key.length}`);
      continue;
    }

    // Remove unmatched trailing quotes
    if (key.endsWith('"')) {
      key = key.substring(0, key.length - 1);
      console.log(`[cleanPrivateKey] Stripped unmatched trailing double quote. New length: ${key.length}`);
      continue;
    }
    if (key.endsWith("'")) {
      key = key.substring(0, key.length - 1);
      console.log(`[cleanPrivateKey] Stripped unmatched trailing single quote. New length: ${key.length}`);
      continue;
    }
  }

  // Handle escaped newlines
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, "\n");
    console.log(`[cleanPrivateKey] Replaced escaped newlines with actual newlines. New length: ${key.length}`);
  }

  // Ensure BEGIN/END headers are intact
  if (!key.includes("-----BEGIN PRIVATE KEY-----") && !key.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    console.log("[cleanPrivateKey] WARNING: Key is missing standard BEGIN headers!");
  }
  if (!key.includes("-----END PRIVATE KEY-----") && !key.includes("-----END RSA PRIVATE KEY-----")) {
    console.log("[cleanPrivateKey] WARNING: Key is missing standard END headers!");
  }

  return key;
}

// Helper to authenticate with Google Sheets API via Service Account
let cachedSheetsClient: any = null;

function getSheetsClient() {
  if (cachedSheetsClient) {
    return cachedSheetsClient;
  }

  const email = cleanServiceAccountEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = cleanPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!email || !privateKey) {
    console.error("[getSheetsClient] Error: Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    throw new Error(
      "Missing Google Service Account credentials. Please configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in the Environment Settings."
    );
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    cachedSheetsClient = google.sheets({ version: "v4", auth });
    return cachedSheetsClient;
  } catch (error: any) {
    console.error("[getSheetsClient] Error creating JWT or Sheets client:", error);
    throw error;
  }
}

// API Route: Check if Google Sheets API is configured
app.get("/api/sheets/config", (req, res) => {
  const email = cleanServiceAccountEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = cleanPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  res.json({
    configured: !!(email && privateKey),
    clientEmail: email || null,
  });
});

// API Route: Safe diagnostic endpoint for private key format (no secret values returned)
// Guarded: only available outside production so it can't leak key metadata on the live deployment.
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-key", (req, res) => {
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!rawKey) {
      return res.json({ error: "Key is undefined or empty" });
    }

    const cleaned = cleanPrivateKey(rawKey);
    const info = {
      lengthRaw: rawKey.length,
      lengthCleaned: cleaned ? cleaned.length : 0,
      startsWithRaw: rawKey.substring(0, 40),
      endsWithRaw: rawKey.substring(Math.max(0, rawKey.length - 40)),
      startsWithCleaned: cleaned ? cleaned.substring(0, 40) : null,
      endsWithCleaned: cleaned ? cleaned.substring(Math.max(0, cleaned?.length ? cleaned.length - 40 : 0)) : null,
      containsEscapedN: rawKey.includes("\\n"),
      containsActualN: rawKey.includes("\n"),
      hasBeginHeader: cleaned ? (cleaned.includes("-----BEGIN PRIVATE KEY-----") || cleaned.includes("-----BEGIN RSA PRIVATE KEY-----")) : false,
      hasEndHeader: cleaned ? (cleaned.includes("-----END PRIVATE KEY-----") || cleaned.includes("-----END RSA PRIVATE KEY-----")) : false,
    };
    res.json(info);
  });
}

// Ledger state now lives in Google Sheets (source of truth) instead of a local file —
// Cloud Run's filesystem is ephemeral and not shared across instances, so a local file
// would silently lose data on every redeploy or when the service scales past 1 replica.
// We store the full ledger blob (emails/matches/overrides) as JSON, chunked across
// multiple cells in column A because a single Sheets cell caps out at 50,000 characters.
const LEDGER_SPREADSHEET_ID = process.env.LEDGER_SPREADSHEET_ID || "15Mj6A4XAj42T92ddmbgbW-lT6ulgzkc_qx2fHp0YT0c";
const LEDGER_SHEET_TAB = "_LedgerState";
const LEDGER_CELL_CHUNK_SIZE = 45000; // stay safely under the 50,000-char Sheets cell limit

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks.length > 0 ? chunks : [""];
}

async function ensureLedgerSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: LEDGER_SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some(
    (s: any) => s.properties?.title === LEDGER_SHEET_TAB
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: LEDGER_SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: LEDGER_SHEET_TAB } } }],
      },
    });
  }
}

// API Route: Save Shared Ledger State (writes to Google Sheets, chunked across cells)
app.post("/api/ledger", async (req, res) => {
  try {
    const { emails, matches, overrides } = req.body;
    const timestamp = new Date().toISOString();

    const ledgerData = { emails, matches, overrides, updatedAt: timestamp };
    const serialized = JSON.stringify(ledgerData);
    const chunks = chunkString(serialized, LEDGER_CELL_CHUNK_SIZE);

    let sheets;
    try {
      sheets = getSheetsClient();
    } catch (authError: any) {
      return res.status(412).json({
        error: "AUTHENTICATION_FAILED",
        message: authError.message,
      });
    }

    await ensureLedgerSheetExists(sheets);

    // Clear the column first so a shorter payload doesn't leave stale trailing chunks
    await sheets.spreadsheets.values.clear({
      spreadsheetId: LEDGER_SPREADSHEET_ID,
      range: `${LEDGER_SHEET_TAB}!A:A`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: LEDGER_SPREADSHEET_ID,
      range: `${LEDGER_SHEET_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: chunks.map((c) => [c]) },
    });

    res.json({
      success: true,
      updatedAt: timestamp,
    });
  } catch (error: any) {
    console.error("Error saving ledger to Google Sheets:", error);
    res.status(500).json({
      error: "SAVE_FAILED",
      message: error.message || "Failed to save ledger to Google Sheets.",
    });
  }
});

// API Route: Load Shared Ledger State (reads from Google Sheets, reassembles chunks)
app.get("/api/ledger", async (req, res) => {
  try {
    let sheets;
    try {
      sheets = getSheetsClient();
    } catch (authError: any) {
      return res.status(412).json({
        error: "AUTHENTICATION_FAILED",
        message: authError.message,
      });
    }

    await ensureLedgerSheetExists(sheets);
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: LEDGER_SPREADSHEET_ID,
      range: `${LEDGER_SHEET_TAB}!A:A`,
    });

    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      return res.json(null); // No ledger saved yet
    }

    const raw = rows.map((r: any[]) => r[0] || "").join("");
    if (!raw) {
      return res.json(null);
    }

    res.json(JSON.parse(raw));
  } catch (error: any) {
    console.error("Error reading ledger from Google Sheets:", error);
    res.status(500).json({
      error: "LOAD_FAILED",
      message: error.message || "Failed to load ledger from Google Sheets.",
    });
  }
});

// API Route: Real Google Sheets Sync
app.post("/api/sheets/sync", async (req, res) => {
  try {
    const { matches, spreadsheetId, localTime } = req.body;

    if (!matches || !Array.isArray(matches)) {
      return res.status(400).json({ error: "Invalid matches data" });
    }

    const targetSpreadsheetId = spreadsheetId || "15Mj6A4XAj42T92ddmbgbW-lT6ulgzkc_qx2fHp0YT0c";

    // 1. Get authenticated sheets client
    let sheets;
    try {
      sheets = getSheetsClient();
    } catch (authError: any) {
      return res.status(412).json({
        error: "AUTHENTICATION_FAILED",
        message: authError.message,
      });
    }

    // 2. Format ledger rows for sheet write
    const headers = ["ECO / ECN ID", "DCN(s)", "Status", "Confidence Rate", "Match Level", "Audit Flag", "Sourced Email ID(s)", "Notes", "เวลาที่บันทึกข้อมูล (Recorded Time)", "Last Synced (Local Time)"];
    const syncTimeStr = localTime || new Date().toLocaleString("th-TH");

    const rows = matches.map((m: any) => [
      m.ecoId || "",
      (m.dcns && m.dcns.join(", ")) || "—",
      m.status || "OPEN",
      `${Math.round((m.confidence || 0) * 100)}%`,
      m.matchType || "—",
      m.flag || "—",
      m.source || "—",
      m.notes || "—",
      m.timestamp || "—",
      syncTimeStr
    ]);

    const values = [headers, ...rows];

    // 3. Write data to Google Sheet (Overwriting Sheet1/first grid)
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    res.json({
      success: true,
      message: "Sync completed successfully!",
      spreadsheetId: targetSpreadsheetId,
      rowCount: matches.length,
    });

  } catch (error: any) {
    console.error("Google Sheets Sync Error:", error);
    res.status(500).json({
      error: "SYNC_FAILED",
      message: error.message || "Failed to sync to Google Sheets due to an internal API error.",
      details: error.errors || null
    });
  }
});

// Setup dev/prod mode for static assets and HTML serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
