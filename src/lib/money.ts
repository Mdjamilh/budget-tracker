/**
 * Money is stored as integer cents everywhere. Floating point never touches
 * a stored amount, so totals don't drift (0.1 + 0.2 problems).
 */
export type Cents = number;

const CURRENCY = /^[$€£¥₹৳]|[$€£¥₹৳]$/g;

/**
 * Parses what people type and what bank exports contain: "1,234.56",
 * "-12", "$ 7.5", "(12.00)" for a negative, "12.00-" for a trailing minus.
 * Returns undefined for anything that isn't a single clear amount,
 * including ambiguous signs such as "--5" or "(-5)".
 */
export function parseAmount(input: string): Cents | undefined {
  let text = input.trim().replace(/[\s ]/g, "");
  if (!text) return undefined;

  let signs = 0;
  if (/^\(.*\)$/.test(text)) {
    signs++;
    text = text.slice(1, -1);
  }
  if (text.endsWith("-")) {
    signs++;
    text = text.slice(0, -1);
  }
  text = text.replace(CURRENCY, "");
  if (text.startsWith("-")) {
    signs++;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  text = text.replace(CURRENCY, "");
  if (signs > 1) return undefined;

  // Thousands separators only between groups of three digits.
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(text) && !/^\.\d{1,2}$/.test(text)) return undefined;
  const [whole = "0", fraction = ""] = text.replace(/,/g, "").split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return undefined;
  return signs ? -cents : cents;
}

export function formatMoney(cents: Cents, currency = "USD", { sign = false } = {}): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, signDisplay: sign ? "exceptZero" : "auto" }).format(cents / 100);
}

/** Whole-unit amount for compact chart axes: 1234567 -> "$12.3K". */
export function formatCompact(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

export const sum = (values: Cents[]): Cents => values.reduce((total, v) => total + v, 0);

/** Share of `part` in `whole` as a percentage, safe for zero. */
export function percent(part: Cents, whole: Cents): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}
