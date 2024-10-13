import { describe, expect, it } from "vitest";

import { dueTransactions, nextDue } from "./recurring";
import type { RecurringRule } from "./types";

const rent: RecurringRule = {
  id: "rent",
  description: "Rent",
  amount: -120000,
  categoryId: "housing",
  dayOfMonth: 1,
  startMonth: "2026-01",
};

describe("dueTransactions", () => {
  it("catches up on every month since the start, up to today", () => {
    const { transactions, lastGenerated } = dueTransactions(rent, "2026-03-15", 42);
    expect(transactions.map((t) => t.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(transactions[0]).toEqual({ date: "2026-01-01", description: "Rent", amount: -120000, categoryId: "housing", recurringId: "rent", createdAt: 42 });
    expect(lastGenerated).toBe("2026-03");
  });

  it("never generates a month twice", () => {
    const first = dueTransactions(rent, "2026-03-15");
    const again = dueTransactions({ ...rent, lastGenerated: first.lastGenerated }, "2026-03-20");
    expect(again.transactions).toEqual([]);
    expect(again.lastGenerated).toBe("2026-03");
  });

  it("waits for the due day in the current month", () => {
    const payday = { ...rent, dayOfMonth: 25 };
    expect(dueTransactions(payday, "2026-01-24").transactions).toEqual([]);
    expect(dueTransactions(payday, "2026-01-25").transactions.map((t) => t.date)).toEqual(["2026-01-25"]);
  });

  it("uses the last day of short months and stops at the end month", () => {
    const rule = { ...rent, dayOfMonth: 31, startMonth: "2026-01", endMonth: "2026-03" };
    expect(dueTransactions(rule, "2026-12-31").transactions.map((t) => t.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("does nothing before the start month", () => {
    expect(dueTransactions({ ...rent, startMonth: "2026-06" }, "2026-03-01").transactions).toEqual([]);
  });
});

describe("nextDue", () => {
  it("finds the next upcoming date", () => {
    expect(nextDue({ ...rent, lastGenerated: "2026-03" })).toBe("2026-04-01");
    expect(nextDue({ ...rent, dayOfMonth: 31, lastGenerated: "2026-01" })).toBe("2026-02-28");
    expect(nextDue({ ...rent, startMonth: "2026-06" })).toBe("2026-06-01");
    expect(nextDue({ ...rent, endMonth: "2026-03", lastGenerated: "2026-03" })).toBeUndefined();
  });
});
