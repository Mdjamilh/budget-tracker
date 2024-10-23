import { monthOf } from "./dates";
import type { MonthKey, Transaction } from "./types";

export type TransactionFilter = {
  /** null for all months. */
  month: MonthKey | null;
  /** A category id, "none" for uncategorized, or null for any. */
  category: string | null;
  text: string;
};

/** Matches description, note, or the amount as typed ("12.50" finds -$12.50). */
export function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  const text = filter.text.trim().toLowerCase();
  return transactions.filter((t) => {
    if (filter.month && monthOf(t.date) !== filter.month) return false;
    if (filter.category === "none" ? t.categoryId !== null : filter.category && t.categoryId !== filter.category) return false;
    if (!text) return true;
    return (
      t.description.toLowerCase().includes(text) ||
      (t.note?.toLowerCase().includes(text) ?? false) ||
      (Math.abs(t.amount) / 100).toFixed(2).includes(text)
    );
  });
}
