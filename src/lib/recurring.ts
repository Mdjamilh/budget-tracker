import { addMonths, dateInMonth, monthOf } from "./dates";
import type { RecurringRule, Transaction } from "./types";

/**
 * Transactions a rule should have produced by `todayDate` but hasn't yet.
 * Each month is generated once: `lastGenerated` moves forward, so opening the
 * app twice never duplicates rent. A due day later in the current month is
 * left until that day arrives.
 */
export function dueTransactions(rule: RecurringRule, todayDate: string, now = Date.now()): { transactions: Omit<Transaction, "id">[]; lastGenerated?: string } {
  const transactions: Omit<Transaction, "id">[] = [];
  let month = rule.lastGenerated ? addMonths(rule.lastGenerated, 1) : rule.startMonth;
  let lastGenerated = rule.lastGenerated;
  const lastMonth = rule.endMonth && rule.endMonth < monthOf(todayDate) ? rule.endMonth : monthOf(todayDate);

  while (month <= lastMonth) {
    const date = dateInMonth(month, rule.dayOfMonth);
    if (date > todayDate) break;
    transactions.push({
      date,
      description: rule.description,
      amount: rule.amount,
      categoryId: rule.categoryId,
      recurringId: rule.id,
      createdAt: now,
    });
    lastGenerated = month;
    month = addMonths(month, 1);
  }
  return { transactions, lastGenerated };
}

/** The next date a rule will produce a transaction (it may already be due), if any. */
export function nextDue(rule: RecurringRule): string | undefined {
  const month = rule.lastGenerated ? addMonths(rule.lastGenerated, 1) : rule.startMonth;
  if (rule.endMonth && month > rule.endMonth) return undefined;
  return dateInMonth(month, rule.dayOfMonth);
}
