import type { MonthKey } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's calendar date in the user's time zone, as "YYYY-MM-DD". */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const monthOf = (date: string): MonthKey => date.slice(0, 7);

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const index = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Months from `from` to `to`, inclusive, oldest first. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  return months;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** A day in a month, clamped so "the 31st" means Feb 28/29 in February. */
export function dateInMonth(month: MonthKey, day: number): string {
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

export function formatMonth(month: MonthKey, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-US", { month: style, year: "numeric", timeZone: "UTC" });
}

export function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** How far through the month `date` is, from 0 to 1, for "on track" comparisons. */
export function monthProgress(month: MonthKey, date: string): number {
  if (monthOf(date) < month) return 0;
  if (monthOf(date) > month) return 1;
  return Number(date.slice(8, 10)) / daysInMonth(month);
}
