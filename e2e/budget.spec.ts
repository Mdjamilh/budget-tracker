import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

// A fixed "today" keeps sample data and month labels predictable.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-15T12:00:00"));
});

const nav = (page: Page, name: string) => async () => {
  // On phones (below Mantine's "sm" breakpoint, 768px) the navigation sits behind the menu button.
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
};

async function withSampleData(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("first visit offers sample data and shows a monthly overview", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Budget" })).toBeVisible();
  await page.getByRole("button", { name: "Explore with sample data" }).click();

  await expect(page.getByText("October 2026")).toBeVisible();
  await expect(page.getByText("Budget left")).toBeVisible();
  await expect(page.getByLabel(/Housing: 100% of budget used/)).toBeVisible();

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByText("September 2026")).toBeVisible();
  // September's pay has arrived, so income is no longer zero.
  await expect(page.getByRole("group", { name: "Income" })).not.toContainText("$0.00");
});

test("add an expense, then find it by searching", async ({ page }) => {
  await withSampleData(page);
  await nav(page, "Transactions")();
  await page.getByRole("button", { name: "Add" }).click();

  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Amount").fill("abc");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog.getByText("Enter an amount like 12.50")).toBeVisible();

  await dialog.getByLabel("Amount").fill("23.40");
  await dialog.getByLabel("Description").fill("Fresh Market");
  await dialog.getByLabel("Description").blur();
  // The category is suggested from earlier purchases at the same shop.
  await expect(dialog.getByRole("textbox", { name: "Category" })).toHaveValue("Groceries");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("Search").fill("23.40");
  const rows = page.getByRole("row").filter({ hasText: "Fresh Market" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("-$23.40");
});

test("import a bank CSV once, even if the same file is chosen twice", async ({ page }) => {
  await page.goto("/");
  await nav(page, "Import")();

  const choose = async (label: string) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: label }).click()]);
    await chooser.setFiles("e2e/files/bank-export.csv");
  };

  await choose("Choose CSV file");
  await expect(page.getByRole("textbox", { name: "Date format" })).toHaveValue("DD/MM/YYYY");
  await expect(page.getByText("Line 7: \"31/09/2026\" isn't a DD/MM/YYYY date")).toBeVisible();
  await page.getByRole("button", { name: "Import 4 transactions" }).click();

  await expect(page.getByText("Imported 4 transactions")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "ACME PAYROLL" })).toContainText("+$2,500.00");

  await nav(page, "Import")();
  await choose("Choose CSV file");
  await page.getByRole("button", { name: "Import 4 transactions" }).click();
  await expect(page.getByText("Imported 0 transactions")).toBeVisible();
  await expect(page.getByText("4 already imported, skipped. 1 row with problems skipped.")).toBeVisible();
});

test("set a budget and see it on the overview", async ({ page }) => {
  await withSampleData(page);
  await nav(page, "Budgets")();
  const health = page.getByLabel("Monthly budget for Health");
  await health.fill("75");
  await health.press("Enter");
  await expect(health).toHaveValue("75.00");

  await nav(page, "Overview")();
  await expect(page.getByText("Health")).toBeVisible();
  await expect(page.getByText("$75.00 left")).toBeVisible();
});

test("deleting transactions can be undone", async ({ page }) => {
  await withSampleData(page);
  await nav(page, "Transactions")();
  await page.getByLabel("Search").fill("Streamly");
  await page.getByRole("checkbox", { name: "Select Streamly" }).check();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Nothing matches these filters.")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Streamly" })).toHaveCount(1);
});

test("data survives a reload and round-trips through a backup", async ({ page }) => {
  await withSampleData(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await nav(page, "Settings")();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).click()]);
  expect(download.suggestedFilename()).toBe("budget-backup-2026-10-15.json");
  const backupPath = await download.path();
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  expect(backup.transactions.length).toBeGreaterThan(50);

  await page.getByRole("button", { name: "Delete all data" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("Your 0 transactions")).toBeVisible();

  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Restore from backup" }).click()]);
  await chooser.setFiles(backupPath);
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`Your ${backup.transactions.length} transactions`)).toBeVisible();
});

test("works offline once loaded", async ({ page, context }) => {
  await withSampleData(page);
  // The service worker takes control on the first visit once it has cached the app.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await nav(page, "Transactions")();
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Maple Street Apartments" })).toHaveCount(1);
});
