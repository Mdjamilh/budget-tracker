import { describe, expect, it } from "vitest";

import { budgetStatus, monthlyTotals, summarizeMonth } from "./budget";
import type { Category, Transaction } from "./types";

const cat = (id: string, kind: Category["kind"], budget = 0, extra: Partial<Category> = {}): Category => ({ id, name: id, kind, color: "blue", budget, ...extra });
let n = 0;
const tx = (date: string, amount: number, categoryId: string | null): Transaction => ({
  id: `t${n++}`,
  date,
  description: "x",
  amount,
  categoryId,
  createdAt: 0,
});

const categories = [
  cat("groceries", "expense", 40000),
  cat("rent", "expense", 120000, { fixed: true }),
  cat("fun", "expense"),
  cat("salary", "income"),
  cat("old", "expense", 5000, { archived: true }),
];

describe("summarizeMonth", () => {
  it("totals income, spending, refunds and uncategorized money for one month", () => {
    const s = summarizeMonth(
      [
        tx("2026-04-01", 300000, "salary"),
        tx("2026-04-02", -120000, "rent"),
        tx("2026-04-03", -10000, "groceries"),
        tx("2026-04-09", -5000, "groceries"),
        tx("2026-04-10", 2000, "groceries"), // refund
        tx("2026-04-12", -2500, null),
        tx("2026-04-13", 1500, null), // money in with no category counts as income
        tx("2026-03-30", -99999, "groceries"), // other month
      ],
      categories,
      "2026-04",
      "2026-04-15",
    );
    expect(s).toMatchObject({ income: 301500, expenses: 135500, net: 166000, uncategorized: 2500, budgeted: 160000, spentAgainstBudget: 133000 });
    expect(s.categories.map((c) => [c.category.id, c.spent, c.remaining, c.status])).toEqual([
      ["rent", 120000, 0, "ok"],
      ["groceries", 13000, 27000, "ok"],
    ]);
  });

  it("shows budgeted categories with no spending, but not archived ones", () => {
    const s = summarizeMonth([], categories, "2026-04", "2026-04-01");
    expect(s.categories.map((c) => c.category.id)).toEqual(["groceries", "rent"]);
  });

  it("still shows spending in an archived or unbudgeted category", () => {
    const s = summarizeMonth([tx("2026-04-02", -100, "old"), tx("2026-04-02", -300, "fun")], categories, "2026-04", "2026-04-02");
    expect(s.categories.map((c) => [c.category.id, c.status])).toEqual([
      ["fun", "none"],
      ["old", "ok"],
      ["groceries", "ok"],
      ["rent", "ok"],
    ]);
  });
});

describe("budgetStatus", () => {
  it("compares spending with how far through the month we are", () => {
    expect(budgetStatus(6000, 10000, 10 / 30)).toBe("ahead");
    expect(budgetStatus(6000, 10000, 25 / 30)).toBe("ok");
    expect(budgetStatus(10000, 10000, 1)).toBe("ok");
    expect(budgetStatus(10001, 10000, 0.2)).toBe("over");
    expect(budgetStatus(500, 0, 0.5)).toBe("none");
  });

  it("never warns about pace for fixed bills paid in one go", () => {
    expect(budgetStatus(120000, 120000, 2 / 30, true)).toBe("ok");
    expect(budgetStatus(120001, 120000, 2 / 30, true)).toBe("over");
    expect(budgetStatus(120000, 120000, 2 / 30, false)).toBe("ahead");
  });
});

describe("monthlyTotals", () => {
  it("returns one row per month, including empty months", () => {
    const rows = monthlyTotals(
      [tx("2026-01-05", 100000, "salary"), tx("2026-01-06", -40000, "rent"), tx("2026-03-02", -500, "fun")],
      categories,
      ["2026-01", "2026-02", "2026-03"],
    );
    expect(rows).toEqual([
      { month: "2026-01", income: 100000, expenses: 40000, net: 60000 },
      { month: "2026-02", income: 0, expenses: 0, net: 0 },
      { month: "2026-03", income: 0, expenses: 500, net: -500 },
    ]);
  });
});
