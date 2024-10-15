import type { Transaction } from "./types";

/**
 * A rough merchant key: "SQ *COFFEE CORNER #1234 BOSTON" and
 * "Coffee Corner 0042" both become "coffee corner". Card processor prefixes,
 * store numbers and dates are noise for matching.
 */
export function payeeKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/^(sq|tst|pos|sp|pp|paypal)\s*\*\s*/, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return words.slice(0, 2).join(" ");
}

/** The category most recently used for the same merchant, if any. */
export function suggestCategory(description: string, history: Pick<Transaction, "description" | "categoryId" | "date">[]): string | null {
  const key = payeeKey(description);
  if (!key) return null;
  let best: { date: string; categoryId: string } | undefined;
  for (const t of history) {
    if (!t.categoryId || payeeKey(t.description) !== key) continue;
    if (!best || t.date > best.date) best = { date: t.date, categoryId: t.categoryId };
  }
  return best?.categoryId ?? null;
}
