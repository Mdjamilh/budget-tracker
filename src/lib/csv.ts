import Papa from "papaparse";

import { parseAmount, type Cents } from "./money";
import type { Category, Transaction } from "./types";

/** Rows keep blank lines (as empty rows) so error line numbers match the file. */
export type CsvTable = { headers: string[]; rows: string[][] };

export function readCsv(text: string): CsvTable {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, "").replace(/\r?\n$/, ""));
  const [headers = [], ...rows] = result.data;
  return { headers: headers.map((h) => h.trim()), rows };
}

const isBlank = (cells: string[]) => cells.every((c) => !c.trim());

/** Non-blank rows only, e.g. for previews and format guessing. */
export const dataRows = (table: CsvTable) => table.rows.filter((r) => !isBlank(r));

/** Which column holds what. Banks use either one signed amount or separate debit/credit columns. */
export type ColumnMapping = {
  date?: number;
  description?: number;
  amount?: number;
  debit?: number;
  credit?: number;
};

const PATTERNS: [keyof ColumnMapping, RegExp][] = [
  ["date", /^(transaction |posted |posting |value )?date$|^date posted$|^posted$/i],
  ["description", /description|payee|merchant|details|narrative|memo|name/i],
  ["debit", /debit|withdrawal|money out|paid out|outflow/i],
  ["credit", /credit|deposit|money in|paid in|inflow/i],
  ["amount", /^amount|^value$|^sum$/i],
];

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const [field, pattern] of PATTERNS) {
    const index = headers.findIndex((h, i) => !used.has(i) && pattern.test(h));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type DateFormat = "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
export const DATE_FORMATS: DateFormat[] = ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Returns "YYYY-MM-DD", or undefined if the value isn't a real date in that format. */
export function parseDate(value: string, format: DateFormat): string | undefined {
  const parts = value.trim().split(/[-/.]/).map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isInteger(p))) return undefined;
  const [a, b, c] = parts as [number, number, number];
  const [y, m, d] = format === "YYYY-MM-DD" ? [a, b, c] : format === "MM/DD/YYYY" ? [c, a, b] : [c, b, a];
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return undefined;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * The first format every sample parses in. "03/04/2026" fits both US and
 * day-first formats, so a later "13/04/2026" is what settles it.
 */
export function guessDateFormat(samples: string[]): DateFormat | undefined {
  const values = samples.filter((s) => s.trim());
  return DATE_FORMATS.find((f) => values.length > 0 && values.every((v) => parseDate(v, f)));
}

export const normalizeDescription = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

export type ImportedRow = { line: number; date: string; description: string; amount: Cents; importKey: string };
export type ImportError = { line: number; message: string };

/**
 * Turns CSV rows into transactions. Each row gets an import key from its
 * date, amount and description, plus a counter for identical rows within the
 * file, so two real coffees on the same day both import, but importing the
 * same file again adds nothing.
 */
export function toTransactions(
  table: CsvTable,
  mapping: ColumnMapping,
  dateFormat: DateFormat,
  { flipSigns = false }: { flipSigns?: boolean } = {},
): { rows: ImportedRow[]; errors: ImportError[] } {
  const rows: ImportedRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Map<string, number>();

  table.rows.forEach((cells, i) => {
    if (isBlank(cells)) return;
    const line = i + 2; // 1-based, after the header row
    const cell = (index?: number) => (index === undefined ? "" : (cells[index] ?? "").trim());

    const date = parseDate(cell(mapping.date), dateFormat);
    if (!date) return errors.push({ line, message: `"${cell(mapping.date)}" isn't a ${dateFormat} date` });

    let amount: Cents | undefined;
    if (mapping.amount !== undefined) {
      amount = parseAmount(cell(mapping.amount));
    } else {
      const out = cell(mapping.debit) ? parseAmount(cell(mapping.debit)) : 0;
      const into = cell(mapping.credit) ? parseAmount(cell(mapping.credit)) : 0;
      if (out !== undefined && into !== undefined) amount = Math.abs(into) - Math.abs(out);
    }
    if (amount === undefined) return errors.push({ line, message: "Couldn't read the amount" });
    if (flipSigns) amount = -amount;

    const description = cell(mapping.description) || "(no description)";
    const base = `${date}|${amount}|${normalizeDescription(description)}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    rows.push({ line, date, description, amount, importKey: `${base}|${occurrence}` });
  });
  return { rows, errors };
}

/** Rows not already imported (matched by import key). */
export function withoutDuplicates(rows: ImportedRow[], existingKeys: Set<string>) {
  const fresh = rows.filter((r) => !existingKeys.has(r.importKey));
  return { fresh, duplicates: rows.length - fresh.length };
}

/**
 * Spreadsheet apps run cells that start with = + - @ as formulas. Text
 * fields get a leading apostrophe so a payee named "=HYPERLINK(...)" stays text.
 */
export function safeCell(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toCsv(transactions: Transaction[], categories: Category[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  return Papa.unparse({
    fields: ["Date", "Description", "Amount", "Category", "Note"],
    data: sorted.map((t) => [
      t.date,
      safeCell(t.description),
      (t.amount / 100).toFixed(2),
      safeCell(t.categoryId ? (names.get(t.categoryId) ?? "") : ""),
      safeCell(t.note ?? ""),
    ]),
  });
}
