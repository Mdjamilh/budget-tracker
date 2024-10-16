import Dexie, { type Table } from "dexie";

import type { Category, RecurringRule, Transaction } from "../lib/types";

/**
 * All data lives in IndexedDB in this browser. Indexes cover the lookups
 * the app makes: transactions by date and category, imports by key.
 */
export class BudgetDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  recurring!: Table<RecurringRule, string>;

  constructor(name = "budget-tracker") {
    super(name);
    this.version(1).stores({
      transactions: "id, date, categoryId, importKey, recurringId",
      categories: "id, name",
      recurring: "id",
    });
  }
}

export const db = new BudgetDB();

export const newId = () => crypto.randomUUID();
