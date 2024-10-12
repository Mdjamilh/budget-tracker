import { monthOf, monthProgress } from "./dates";
import type { Cents } from "./money";
import type { Category, MonthKey, Transaction } from "./types";

export type BudgetStatus = "none" | "ok" | "ahead" | "over";

export type CategorySpend = {
  category: Category;
  /** Money out minus refunds, as a positive number. */
  spent: Cents;
  budget: Cents;
  remaining: Cents;
  status: BudgetStatus;
};

export type MonthSummary = {
  month: MonthKey;
  income: Cents;
  /** Positive total of money out. */
  expenses: Cents;
  net: Cents;
  categories: CategorySpend[];
  uncategorized: Cents;
  budgeted: Cents;
  /** Spending in categories that have a budget, to compare with `budgeted`. */
  spentAgainstBudget: Cents;
};

/** Margin before spending ahead of the calendar counts as "ahead of pace". */
const PACE_MARGIN = 0.1;

/**
 * Over budget is clear-cut. "Ahead" means spending is running faster than
 * the month: 60% spent on the 10th is a warning, 60% on the 25th is not.
 * Fixed bills are paid in one go, so they can only be over, never ahead.
 */
export function budgetStatus(spent: Cents, budget: Cents, progress: number, fixed = false): BudgetStatus {
  if (budget <= 0) return "none";
  if (spent > budget) return "over";
  if (fixed) return "ok";
  if (spent / budget > Math.min(1, progress + PACE_MARGIN)) return "ahead";
  return "ok";
}

export function summarizeMonth(transactions: Transaction[], categories: Category[], month: MonthKey, todayDate: string): MonthSummary {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const spentBy = new Map<string, Cents>();
  let income = 0;
  let expenses = 0;
  let uncategorized = 0;

  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue;
    const category = t.categoryId ? byId.get(t.categoryId) : undefined;
    if (category?.kind === "income" || (!category && t.amount > 0)) {
      income += t.amount;
      continue;
    }
    // Expense categories: money out adds to spending, refunds take it back.
    expenses -= t.amount;
    if (category) spentBy.set(category.id, (spentBy.get(category.id) ?? 0) - t.amount);
    else uncategorized -= t.amount;
  }

  const progress = monthProgress(month, todayDate);
  const rows = categories
    .filter((c) => c.kind === "expense" && (spentBy.has(c.id) || (c.budget > 0 && !c.archived)))
    .map((category): CategorySpend => {
      const spent = spentBy.get(category.id) ?? 0;
      return { category, spent, budget: category.budget, remaining: category.budget - spent, status: budgetStatus(spent, category.budget, progress, category.fixed) };
    })
    .sort((a, b) => b.spent - a.spent || a.category.name.localeCompare(b.category.name));

  const budgetedRows = rows.filter((r) => r.budget > 0);
  return {
    month,
    income,
    expenses,
    net: income - expenses,
    categories: rows,
    uncategorized,
    budgeted: budgetedRows.reduce((s, r) => s + r.budget, 0),
    spentAgainstBudget: budgetedRows.reduce((s, r) => s + r.spent, 0),
  };
}

export type MonthTotals = { month: MonthKey; income: Cents; expenses: Cents; net: Cents };

/** Income and spending per month, for the trend chart. */
export function monthlyTotals(transactions: Transaction[], categories: Category[], months: MonthKey[]): MonthTotals[] {
  const wanted = new Set(months);
  const relevant = transactions.filter((t) => wanted.has(monthOf(t.date)));
  return months.map((month) => {
    const s = summarizeMonth(relevant, categories, month, `${month}-01`);
    return { month, income: s.income, expenses: s.expenses, net: s.net };
  });
}
