import type { Cents } from "./money";

/** "2026-10": the unit budgets are tracked in. */
export type MonthKey = string;

export type CategoryKind = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  /** Monthly budget for expense categories; 0 means no budget. */
  budget: Cents;
  /** Paid once a month (rent, subscriptions): no "spending too fast" warnings. */
  fixed?: boolean;
  archived?: boolean;
};

export type Transaction = {
  id: string;
  /** Calendar date "YYYY-MM-DD", no time zone. */
  date: string;
  description: string;
  /** Negative for money out, positive for money in. */
  amount: Cents;
  categoryId: string | null;
  note?: string;
  /** Set on imported rows, to spot the same bank row imported twice. */
  importKey?: string;
  recurringId?: string;
  createdAt: number;
};

export type RecurringRule = {
  id: string;
  description: string;
  amount: Cents;
  categoryId: string | null;
  /** 1–31; months without that day use their last day. */
  dayOfMonth: number;
  startMonth: MonthKey;
  endMonth?: MonthKey;
  /** The latest month already turned into a transaction. */
  lastGenerated?: MonthKey;
};
