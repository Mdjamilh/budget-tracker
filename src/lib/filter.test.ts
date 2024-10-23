import { describe, expect, it } from "vitest";

import { filterTransactions } from "./filter";
import type { Transaction } from "./types";

const t = (id: string, date: string, description: string, amount: number, categoryId: string | null, note?: string): Transaction => ({
  id,
  date,
  description,
  amount,
  categoryId,
  note,
  createdAt: 0,
});

const all = [
  t("a", "2026-04-02", "Fresh Market", -4525, "food"),
  t("b", "2026-04-10", "Payroll", 300000, "salary"),
  t("c", "2026-04-11", "Mystery charge", -1250, null, "ask bank"),
  t("d", "2026-03-30", "Fresh Market", -3000, "food"),
];
const ids = (list: Transaction[]) => list.map((x) => x.id);

describe("filterTransactions", () => {
  it("filters by month and category", () => {
    expect(ids(filterTransactions(all, { month: "2026-04", category: null, text: "" }))).toEqual(["a", "b", "c"]);
    expect(ids(filterTransactions(all, { month: null, category: "food", text: "" }))).toEqual(["a", "d"]);
    expect(ids(filterTransactions(all, { month: null, category: "none", text: "" }))).toEqual(["c"]);
  });

  it("searches descriptions, notes and amounts", () => {
    expect(ids(filterTransactions(all, { month: null, category: null, text: "fresh" }))).toEqual(["a", "d"]);
    expect(ids(filterTransactions(all, { month: null, category: null, text: "BANK" }))).toEqual(["c"]);
    expect(ids(filterTransactions(all, { month: null, category: null, text: "45.25" }))).toEqual(["a"]);
  });
});
