import { describe, expect, it } from "vitest";

import { dataRows, guessDateFormat, guessMapping, parseDate, readCsv, safeCell, toCsv, toTransactions, withoutDuplicates } from "./csv";
import type { Category, Transaction } from "./types";

const BANK = `\uFEFFTransaction Date,Description,Amount,Balance
2026-04-01,"ACME PAYROLL",3000.00,3500.00
2026-04-02,"CITY RENT, APT 4",-1200.00,2300.00
2026-04-03,Coffee Corner,-4.50,2295.50
2026-04-03,Coffee Corner,-4.50,2291.00

2026-04-31,Bad date,-1.00,0
2026-04-05,Bad amount,abc,0
`;

describe("reading a bank export", () => {
  it("guesses columns, reads rows and reports problems by line", () => {
    const table = readCsv(BANK);
    expect(table.headers).toEqual(["Transaction Date", "Description", "Amount", "Balance"]);
    const mapping = guessMapping(table.headers);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
    // "2026-04-31" doesn't exist, but the rest of the file settles the format.
    expect(guessDateFormat(dataRows(table).map((r) => r[0]!))).toBe("YYYY-MM-DD");

    const { rows, errors } = toTransactions(table, mapping, "YYYY-MM-DD");
    expect(rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ["2026-04-01", "ACME PAYROLL", 300000],
      ["2026-04-02", "CITY RENT, APT 4", -120000],
      ["2026-04-03", "Coffee Corner", -450],
      ["2026-04-03", "Coffee Corner", -450],
    ]);
    expect(errors).toEqual([
      { line: 7, message: '"2026-04-31" isn\'t a YYYY-MM-DD date' },
      { line: 8, message: "Couldn't read the amount" },
    ]);
  });

  it("keeps two identical purchases but skips rows already imported", () => {
    const table = readCsv(BANK);
    const { rows } = toTransactions(table, guessMapping(table.headers), "YYYY-MM-DD");
    expect(new Set(rows.map((r) => r.importKey)).size).toBe(4);

    const again = withoutDuplicates(rows, new Set(rows.slice(0, 3).map((r) => r.importKey)));
    expect(again.duplicates).toBe(3);
    expect(again.fresh.map((r) => r.description)).toEqual(["Coffee Corner"]);
  });

  it("handles separate debit and credit columns and flipped card exports", () => {
    const table = readCsv("Date,Details,Money Out,Money In\n03/04/2026,Shop,12.00,\n13/04/2026,Refund,,5.00\n");
    const mapping = guessMapping(table.headers);
    expect(mapping).toEqual({ date: 0, description: 1, debit: 2, credit: 3 });
    expect(guessDateFormat(table.rows.map((r) => r[0]!))).toBe("DD/MM/YYYY");

    const { rows } = toTransactions(table, mapping, "DD/MM/YYYY");
    expect(rows.map((r) => [r.date, r.amount])).toEqual([
      ["2026-04-03", -1200],
      ["2026-04-13", 500],
    ]);

    const card = readCsv("Posted Date,Payee,Amount\n04/03/2026,Shop,12.00\n");
    const flipped = toTransactions(card, guessMapping(card.headers), "MM/DD/YYYY", { flipSigns: true });
    expect(flipped.rows[0]).toMatchObject({ date: "2026-04-03", amount: -1200 });
  });
});

describe("parseDate", () => {
  it("validates real calendar dates", () => {
    expect(parseDate("2028-02-29", "YYYY-MM-DD")).toBe("2028-02-29");
    expect(parseDate("2026-02-29", "YYYY-MM-DD")).toBeUndefined();
    expect(parseDate("12/31/2026", "MM/DD/YYYY")).toBe("2026-12-31");
    expect(parseDate("31.12.2026", "DD/MM/YYYY")).toBe("2026-12-31");
    expect(parseDate("31/12/26", "DD/MM/YYYY")).toBeUndefined();
    expect(parseDate("tomorrow", "YYYY-MM-DD")).toBeUndefined();
  });

  it("prefers the format every sample fits", () => {
    expect(guessDateFormat(["2026-01-02", "2026-01-30"])).toBe("YYYY-MM-DD");
    expect(guessDateFormat(["01/02/2026", "01/30/2026"])).toBe("MM/DD/YYYY");
    expect(guessDateFormat([])).toBeUndefined();
    expect(guessDateFormat(["nonsense"])).toBeUndefined();
    // One impossible date doesn't hide an otherwise clear day-first file.
    expect(guessDateFormat(["03/10/2026", "14/10/2026", "31/09/2026"])).toBe("DD/MM/YYYY");
  });
});

describe("export", () => {
  it("writes a CSV that spreadsheets won't execute", () => {
    const categories: Category[] = [{ id: "food", name: "Food", kind: "expense", color: "red", budget: 0 }];
    const transactions: Transaction[] = [
      { id: "2", date: "2026-04-02", description: "=HYPERLINK(\"http://x\")", amount: -1250, categoryId: "food", createdAt: 2 },
      { id: "1", date: "2026-04-01", description: "Pay, April", amount: 300000, categoryId: null, note: "+bonus", createdAt: 1 },
    ];
    expect(toCsv(transactions, categories).split("\r\n")).toEqual([
      "Date,Description,Amount,Category,Note",
      '2026-04-01,"Pay, April",3000.00,,\'+bonus',
      '2026-04-02,"\'=HYPERLINK(""http://x"")",-12.50,Food,',
    ]);
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("Groceries")).toBe("Groceries");
  });
});
