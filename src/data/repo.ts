import { z } from "zod";

import type { ImportedRow } from "../lib/csv";
import { suggestCategory } from "../lib/categorize";
import { dueTransactions } from "../lib/recurring";
import type { Category, RecurringRule, Transaction } from "../lib/types";
import { newId, type BudgetDB } from "./db";

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Salary", kind: "income", color: "teal", budget: 0 },
  { name: "Other income", kind: "income", color: "cyan", budget: 0 },
  { name: "Housing", kind: "expense", color: "indigo", budget: 0, fixed: true },
  { name: "Utilities", kind: "expense", color: "blue", budget: 0, fixed: true },
  { name: "Groceries", kind: "expense", color: "green", budget: 0 },
  { name: "Eating out", kind: "expense", color: "orange", budget: 0 },
  { name: "Transport", kind: "expense", color: "yellow", budget: 0 },
  { name: "Health", kind: "expense", color: "red", budget: 0 },
  { name: "Shopping", kind: "expense", color: "pink", budget: 0 },
  { name: "Subscriptions", kind: "expense", color: "violet", budget: 0, fixed: true },
  { name: "Entertainment", kind: "expense", color: "grape", budget: 0 },
];

/** Gives a first-time user a sensible set of categories. */
export async function seedCategories(db: BudgetDB): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    if ((await db.categories.count()) > 0) return;
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() })));
  });
}

export type TransactionInput = Omit<Transaction, "id" | "createdAt">;

export async function addTransaction(db: BudgetDB, input: TransactionInput): Promise<string> {
  const id = newId();
  await db.transactions.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function updateTransaction(db: BudgetDB, id: string, changes: Partial<TransactionInput>): Promise<void> {
  await db.transactions.update(id, changes);
}

export async function deleteTransactions(db: BudgetDB, ids: string[]): Promise<void> {
  await db.transactions.bulkDelete(ids);
}

/** Restores deleted transactions exactly, for "Undo". */
export async function restoreTransactions(db: BudgetDB, transactions: Transaction[]): Promise<void> {
  await db.transactions.bulkPut(transactions);
}

export async function saveCategory(db: BudgetDB, category: Omit<Category, "id"> & { id?: string }): Promise<string> {
  const id = category.id ?? newId();
  await db.categories.put({ ...category, id });
  return id;
}

/**
 * Deleting a category keeps its transactions: they become uncategorized,
 * so totals for past months don't silently change.
 */
export async function deleteCategory(db: BudgetDB, id: string): Promise<void> {
  await db.transaction("rw", db.categories, db.transactions, db.recurring, async () => {
    await db.transactions.where("categoryId").equals(id).modify({ categoryId: null });
    await db.recurring.filter((r) => r.categoryId === id).modify({ categoryId: null });
    await db.categories.delete(id);
  });
}

/**
 * Adds imported rows that aren't already stored, suggesting a category for
 * each from past transactions with the same merchant. Runs in one IndexedDB
 * transaction, so an import is all or nothing.
 */
export async function importRows(db: BudgetDB, rows: ImportedRow[]): Promise<{ added: number; duplicates: number; categorized: number }> {
  return db.transaction("rw", db.transactions, async () => {
    const keys = rows.map((r) => r.importKey);
    const existing = new Set((await db.transactions.where("importKey").anyOf(keys).toArray()).map((t) => t.importKey));
    const history = await db.transactions.toArray();
    const now = Date.now();
    let categorized = 0;
    const fresh = rows
      .filter((r) => !existing.has(r.importKey))
      .map((r): Transaction => {
        const categoryId = suggestCategory(r.description, history);
        if (categoryId) categorized++;
        return { id: newId(), date: r.date, description: r.description, amount: r.amount, categoryId, importKey: r.importKey, createdAt: now };
      });
    await db.transactions.bulkAdd(fresh);
    return { added: fresh.length, duplicates: rows.length - fresh.length, categorized };
  });
}

export async function saveRecurring(db: BudgetDB, rule: Omit<RecurringRule, "id"> & { id?: string }): Promise<string> {
  const id = rule.id ?? newId();
  await db.recurring.put({ ...rule, id });
  return id;
}

export async function deleteRecurring(db: BudgetDB, id: string): Promise<void> {
  await db.recurring.delete(id);
}

/**
 * Creates any recurring transactions that have come due. The rule is re-read
 * inside the transaction, so two open tabs can't both create this month's rent.
 */
export async function runRecurring(db: BudgetDB, todayDate: string): Promise<number> {
  return db.transaction("rw", db.recurring, db.transactions, async () => {
    let created = 0;
    for (const rule of await db.recurring.toArray()) {
      const { transactions, lastGenerated } = dueTransactions(rule, todayDate);
      if (!transactions.length) continue;
      await db.transactions.bulkAdd(transactions.map((t) => ({ ...t, id: newId() })));
      await db.recurring.update(rule.id, { lastGenerated });
      created += transactions.length;
    }
    return created;
  });
}

const backupSchema = z.object({
  app: z.literal("budget-tracker"),
  version: z.literal(1),
  exportedAt: z.string(),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["expense", "income"]),
      color: z.string(),
      budget: z.number().int(),
      fixed: z.boolean().optional(),
      archived: z.boolean().optional(),
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string(),
      amount: z.number().int(),
      categoryId: z.string().nullable(),
      note: z.string().optional(),
      importKey: z.string().optional(),
      recurringId: z.string().optional(),
      createdAt: z.number(),
    }),
  ),
  recurring: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      amount: z.number().int(),
      categoryId: z.string().nullable(),
      dayOfMonth: z.number().int().min(1).max(31),
      startMonth: z.string().regex(/^\d{4}-\d{2}$/),
      endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      lastGenerated: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }),
  ),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(db: BudgetDB, now = new Date()): Promise<Backup> {
  const [categories, transactions, recurring] = await Promise.all([db.categories.toArray(), db.transactions.toArray(), db.recurring.toArray()]);
  return { app: "budget-tracker", version: 1, exportedAt: now.toISOString(), categories, transactions, recurring };
}

/**
 * Replaces everything with a backup. The file is validated first, and the
 * swap happens in one transaction, so a bad file never leaves half the data.
 */
export async function restoreBackup(db: BudgetDB, data: unknown): Promise<{ transactions: number; categories: number }> {
  const parsed = backupSchema.safeParse(data);
  if (!parsed.success) throw new Error("This file isn't a Budget backup, or it's damaged.");
  const backup = parsed.data;
  await db.transaction("rw", db.categories, db.transactions, db.recurring, async () => {
    await Promise.all([db.categories.clear(), db.transactions.clear(), db.recurring.clear()]);
    await db.categories.bulkAdd(backup.categories);
    await db.transactions.bulkAdd(backup.transactions);
    await db.recurring.bulkAdd(backup.recurring);
  });
  return { transactions: backup.transactions.length, categories: backup.categories.length };
}
