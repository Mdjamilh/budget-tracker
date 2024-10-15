import { describe, expect, it } from "vitest";

import { payeeKey, suggestCategory } from "./categorize";

describe("payeeKey", () => {
  it("ignores card prefixes, store numbers and case", () => {
    expect(payeeKey("SQ *COFFEE CORNER #1234 BOSTON")).toBe("coffee corner");
    expect(payeeKey("Coffee Corner 0042")).toBe("coffee corner");
    expect(payeeKey("AMAZON.COM*2K4")).toBe("amazon com");
    expect(payeeKey("12345")).toBe("");
  });
});

describe("suggestCategory", () => {
  const history = [
    { description: "COFFEE CORNER 01", categoryId: "eating-out", date: "2026-01-02" },
    { description: "Coffee Corner", categoryId: "groceries", date: "2026-03-01" },
    { description: "Coffee corner #9", categoryId: null, date: "2026-04-01" },
    { description: "City Rent", categoryId: "housing", date: "2026-02-01" },
  ];

  it("uses the most recent category for the same merchant", () => {
    expect(suggestCategory("SQ *Coffee Corner 77", history)).toBe("groceries");
    expect(suggestCategory("CITY RENT APRIL", history)).toBe("housing");
  });

  it("returns null for unknown merchants", () => {
    expect(suggestCategory("New Place", history)).toBeNull();
    expect(suggestCategory("###", history)).toBeNull();
  });
});
