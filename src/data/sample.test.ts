import { afterEach, describe, expect, it } from "vitest";

import { summarizeMonth } from "../lib/budget";
import { BudgetDB } from "./db";
import { runRecurring } from "./repo";
import { loadSampleData, sampleTransactions } from "./sample";

describe("sample data", () => {
  const ids = { Housing: "h", Salary: "s", Groceries: "g", Shopping: "sh" };

  it("is deterministic and never in the future", () => {
    const a = sampleTransactions(ids, "2026-10-15");
    expect(sampleTransactions(ids, "2026-10-15")).toEqual(a);
    expect(a.every((t) => t.date <= "2026-10-15" && t.date >= "2026-05-01")).toBe(true);
    expect(a.some((t) => t.amount > 0 && t.categoryId === "sh")).toBe(true); // the refund
    expect(a.filter((t) => t.description === "Maple Street Apartments")).toHaveLength(6);
  });

  let db: BudgetDB | undefined;
  afterEach(async () => {
    await db?.delete();
  });

  it("loads a usable month with budgets, and recurring rules don't duplicate it", async () => {
    db = new BudgetDB("sample-test");
    const count = await loadSampleData(db, "2026-10-15");
    expect(await db.transactions.count()).toBe(count);
    expect(await runRecurring(db, "2026-10-15")).toBe(0);
    expect(await runRecurring(db, "2026-10-28")).toBe(1); // this month's pay arrives on the 28th

    const summary = summarizeMonth(await db.transactions.toArray(), await db.categories.toArray(), "2026-09", "2026-10-15");
    expect(summary.income).toBeGreaterThan(400000);
    expect(summary.budgeted).toBeGreaterThan(0);
    expect(summary.categories.find((c) => c.category.name === "Housing")).toMatchObject({ spent: 140000, status: "ok" });
  });
});
