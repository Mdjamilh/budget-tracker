import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCsv, toTransactions, guessMapping } from "../lib/csv";
import { BudgetDB } from "./db";
import {
  addTransaction,
  deleteCategory,
  exportBackup,
  importRows,
  restoreBackup,
  runRecurring,
  saveCategory,
  saveRecurring,
  seedCategories,
} from "./repo";

let db: BudgetDB;
let n = 0;

beforeEach(async () => {
  db = new BudgetDB(`test-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe("categories", () => {
  it("seeds defaults only once", async () => {
    await seedCategories(db);
    await seedCategories(db);
    const categories = await db.categories.toArray();
    expect(categories.length).toBe(11);
    expect(categories.find((c) => c.name === "Housing")).toMatchObject({ kind: "expense", fixed: true });
  });

  it("keeps transactions when their category is deleted", async () => {
    const food = await saveCategory(db, { name: "Food", kind: "expense", color: "green", budget: 30000 });
    const id = await addTransaction(db, { date: "2026-04-01", description: "Market", amount: -2500, categoryId: food });
    await deleteCategory(db, food);
    expect(await db.categories.get(food)).toBeUndefined();
    expect(await db.transactions.get(id)).toMatchObject({ amount: -2500, categoryId: null });
  });
});

describe("importRows", () => {
  const csv = "Date,Description,Amount\n2026-04-01,COFFEE CORNER 12,-4.50\n2026-04-02,New Shop,-10.00\n";

  it("adds new rows, suggests categories, and skips a repeated import", async () => {
    const food = await saveCategory(db, { name: "Eating out", kind: "expense", color: "orange", budget: 0 });
    await addTransaction(db, { date: "2026-03-01", description: "Coffee Corner", amount: -400, categoryId: food });

    const table = readCsv(csv);
    const { rows } = toTransactions(table, guessMapping(table.headers), "YYYY-MM-DD");

    expect(await importRows(db, rows)).toEqual({ added: 2, duplicates: 0, categorized: 1 });
    expect(await importRows(db, rows)).toEqual({ added: 0, duplicates: 2, categorized: 0 });

    const imported = await db.transactions.where("date").aboveOrEqual("2026-04-01").sortBy("date");
    expect(imported.map((t) => [t.description, t.categoryId])).toEqual([
      ["COFFEE CORNER 12", food],
      ["New Shop", null],
    ]);
  });
});

describe("runRecurring", () => {
  it("creates due transactions once, even if run again", async () => {
    await saveRecurring(db, { description: "Rent", amount: -120000, categoryId: null, dayOfMonth: 1, startMonth: "2026-02" });
    expect(await runRecurring(db, "2026-04-10")).toBe(3);
    expect(await runRecurring(db, "2026-04-20")).toBe(0);
    await Promise.all([runRecurring(db, "2026-05-02"), runRecurring(db, "2026-05-02")]); // two tabs at once
    expect((await db.transactions.toArray()).map((t) => t.date).sort()).toEqual(["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"]);
  });
});

describe("backups", () => {
  it("round-trips everything through a backup file", async () => {
    await seedCategories(db);
    await addTransaction(db, { date: "2026-04-01", description: "Pay", amount: 300000, categoryId: null, note: "April" });
    await saveRecurring(db, { description: "Rent", amount: -1000, categoryId: null, dayOfMonth: 1, startMonth: "2026-01" });
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));

    await db.transactions.clear();
    await addTransaction(db, { date: "2026-05-01", description: "Will be replaced", amount: -1, categoryId: null });

    expect(await restoreBackup(db, backup)).toEqual({ transactions: 1, categories: 11 });
    expect((await db.transactions.toArray()).map((t) => t.description)).toEqual(["Pay"]);
    expect(await db.recurring.count()).toBe(1);
  });

  it("rejects files that aren't backups without touching the data", async () => {
    await addTransaction(db, { date: "2026-04-01", description: "Keep me", amount: -100, categoryId: null });
    await expect(restoreBackup(db, { app: "something-else" })).rejects.toThrow("isn't a Budget backup");
    await expect(restoreBackup(db, { app: "budget-tracker", version: 1, exportedAt: "x", categories: [], transactions: [{ id: "1", date: "April 1", description: "", amount: 1.5, categoryId: null, createdAt: 0 }], recurring: [] })).rejects.toThrow();
    expect((await db.transactions.toArray()).map((t) => t.description)).toEqual(["Keep me"]);
  });
});
