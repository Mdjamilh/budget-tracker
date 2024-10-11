import { describe, expect, it } from "vitest";

import { addMonths, dateInMonth, daysInMonth, formatDay, formatMonth, monthProgress, monthsBetween, today } from "./dates";

describe("month arithmetic", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-03", -15)).toBe("2024-12");
  });

  it("lists months inclusively", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-02", "2026-01")).toEqual([]);
  });

  it("clamps days to the end of short months, including leap years", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dateInMonth("2026-04", 31)).toBe("2026-04-30");
    expect(dateInMonth("2026-01", 5)).toBe("2026-01-05");
  });
});

describe("formatting", () => {
  it("formats without shifting across time zones", () => {
    expect(formatMonth("2026-01")).toBe("January 2026");
    expect(formatMonth("2026-01", "short")).toBe("Jan 2026");
    expect(formatDay("2026-03-01")).toBe("Mar 1, 2026");
    expect(today(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
  });
});

describe("monthProgress", () => {
  it("measures how far through a month a date is", () => {
    expect(monthProgress("2026-04", "2026-04-15")).toBe(0.5);
    expect(monthProgress("2026-04", "2026-03-31")).toBe(0);
    expect(monthProgress("2026-04", "2026-05-01")).toBe(1);
  });
});
