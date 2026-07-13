import ExcelJS from "exceljs";
import { MAX_BULK_INVITE_ROWS } from "./constants.js";

// ─── Invite-sheet parser ──────────────────────────────────────────────────────
// Reads an uploaded spreadsheet buffer (.xlsx / .xls / .csv) into normalized
// invite rows. Pure and side-effect free: it validates STRUCTURE (headers, row
// count, cell presence) but NOT business rules (email uniqueness, role validity,
// existing users) — those live in the controller so single + bulk invites share
// the exact same predicates.
//
// Returns { rows } on success or throws a plain Error whose message is safe to
// surface to the client (the controller maps it to a 400).
//
//   INPUT (buffer) ─▶ load ─▶ locate header row ─▶ map columns ─▶ [rows]
//        │                │              │               │           │
//        ▼                ▼              ▼               ▼           ▼
//    [corrupt?]       [no sheet?]   [missing col?]   [empty?]   [> cap?]

// Header aliases we accept, case/space-insensitive.
const COLUMN_ALIASES = {
  name: ["name", "fullname", "full name"],
  email: ["email", "e-mail", "email address", "mail", "mailid", "mail id"],
  role: ["role", "orgrole", "org role"],
};

const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

// Resolve the header row's cells to our canonical column indexes.
const mapColumns = (headerCells) => {
  const map = { name: null, email: null, role: null };
  headerCells.forEach((raw, idx) => {
    const cell = norm(raw);
    if (!cell) return;
    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[canonical] === null && aliases.includes(cell)) {
        map[canonical] = idx;
      }
    }
  });
  return map;
};

// Pull a row's cells into a flat, 0-indexed array of strings.
const rowToCells = (row) => {
  const cells = [];
  // row.values is 1-indexed (index 0 is empty); normalize to 0-indexed.
  const values = Array.isArray(row.values) ? row.values.slice(1) : [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    // exceljs may return rich objects for hyperlinks / formulas.
    if (v && typeof v === "object") {
      cells[i] = v.text ?? v.result ?? v.hyperlink ?? "";
    } else {
      cells[i] = v ?? "";
    }
  }
  return cells;
};

export const parseInviteSheet = async (buffer) => {
  if (!buffer || !buffer.length) {
    throw new Error("The uploaded file is empty.");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      "Could not read the spreadsheet. Please upload a valid .xlsx file.",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    throw new Error("The spreadsheet has no data.");
  }

  // First non-empty row is the header.
  let headerRowNumber = null;
  let columns = null;
  for (let r = 1; r <= sheet.rowCount; r++) {
    const cells = rowToCells(sheet.getRow(r));
    if (cells.some((c) => norm(c))) {
      columns = mapColumns(cells);
      headerRowNumber = r;
      break;
    }
  }

  if (!columns) {
    throw new Error("The spreadsheet has no data.");
  }
  if (columns.email === null) {
    throw new Error('Missing required column: "email".');
  }
  if (columns.role === null) {
    throw new Error('Missing required column: "role".');
  }

  const rows = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const cells = rowToCells(sheet.getRow(r));
    // Skip fully blank rows (common trailing rows in exported sheets).
    if (!cells.some((c) => norm(c))) continue;

    const email = String(cells[columns.email] ?? "").trim().toLowerCase();
    const role = String(cells[columns.role] ?? "").trim().toLowerCase();
    const name =
      columns.name !== null
        ? String(cells[columns.name] ?? "").trim()
        : "";

    rows.push({ rowNumber: r, name, email, role });

    // Guard memory / abuse: bail as soon as we exceed the cap.
    if (rows.length > MAX_BULK_INVITE_ROWS) {
      throw new Error(
        `Too many rows. A single upload can contain at most ${MAX_BULK_INVITE_ROWS} invites.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new Error("The spreadsheet has a header but no invite rows.");
  }

  return { rows };
};
