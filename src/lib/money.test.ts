import { describe, expect, it } from "vitest";

import { formatCompact, formatMoney, parseAmount, percent, sum } from "./money";

describe("parseAmount", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    [".99", 99],
    ["1,234.56", 123456],
    ["-12.00", -1200],
    ["+3", 300],
    ["$7.50", 750],
    ["-$7.50", -750],
    ["$-7.50", -750],
    ["(12.00)", -1200],
    ["12.00-", -1200],
    ["  1 234.00 ", 123400],
    ["৳500", 50000],
    ["1\u00a0234.00", 123400],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each(["", "abc", "1.234", "12,34", "1,23,456", "--5", "(-5)", "-5-", "1e3", "12.3.4", "$"])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeUndefined();
  });

  it("never introduces floating point error", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in cents it's exact.
    expect(sum([parseAmount("0.10")!, parseAmount("0.20")!])).toBe(30);
    expect(parseAmount("19.99")).toBe(1999);
  });
});

describe("formatting", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(-500)).toBe("-$5.00");
    expect(formatMoney(500, "USD", { sign: true })).toBe("+$5.00");
    expect(formatMoney(0, "USD", { sign: true })).toBe("$0.00");
    expect(formatMoney(1000, "EUR")).toBe("€10.00");
    expect(formatCompact(1234567)).toBe("$12.3K");
  });

  it("computes percentages safely", () => {
    expect(percent(250, 1000)).toBe(25);
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBe(0);
  });
});
