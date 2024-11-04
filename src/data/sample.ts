import { addMonths, dateInMonth, monthOf } from "../lib/dates";
import type { Cents } from "../lib/money";
import type { Category, RecurringRule, Transaction } from "../lib/types";
import { newId, type BudgetDB } from "./db";
import { seedCategories } from "./repo";

/** Small seeded PRNG (mulberry32), so the sample data is the same every time. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draft = Omit<Transaction, "id" | "createdAt">;

const BUDGETS: Record<string, Cents> = {
  Housing: 140000,
  Utilities: 18000,
  Groceries: 45000,
  "Eating out": 20000,
  Transport: 12000,
  Shopping: 15000,
  Subscriptions: 4500,
  Entertainment: 8000,
};

/**
 * Six months of believable spending ending on `today`: pay and rent on fixed
 * days, weekly groceries, a few meals out, the odd refund.
 */
export function sampleTransactions(categoryIds: Record<string, string>, todayDate: string, seed = 7): Draft[] {
  const rand = random(seed);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const out: Draft[] = [];
  const add = (date: string, description: string, amount: Cents, category: string) => {
    if (date <= todayDate) out.push({ date, description, amount, categoryId: categoryIds[category] ?? null });
  };

  const current = monthOf(todayDate);
  for (let i = 5; i >= 0; i--) {
    const month = addMonths(current, -i);
    const day = (d: number) => dateInMonth(month, d);
    add(day(1), "Maple Street Apartments", -140000, "Housing");
    add(day(28), "Northwind Ltd payroll", 410000, "Salary");
    add(day(between(4, 8)), "City Power & Water", -between(9000, 16000), "Utilities");
    add(day(12), "Streamly", -1599, "Subscriptions");
    add(day(19), "Tunely Music", -1099, "Subscriptions");
    for (const d of [3, 10, 17, 24]) add(day(d + between(0, 2)), ["Fresh Market", "GreenLeaf Grocers"][between(0, 1)]!, -between(6000, 13000), "Groceries");
    for (let k = between(4, 8); k > 0; k--) add(day(between(1, 28)), ["Coffee Corner", "Noodle House", "Pizza Place", "Taco Stand"][between(0, 3)]!, -between(450, 4800), "Eating out");
    for (let k = between(2, 5); k > 0; k--) add(day(between(1, 28)), ["Metro card top-up", "RideShare"][between(0, 1)]!, -between(1500, 4000), "Transport");
    if (rand() < 0.7) add(day(between(1, 28)), ["Bookshop", "Outdoor Gear Co", "HomeGoods"][between(0, 2)]!, -between(2000, 16000), "Shopping");
    if (rand() < 0.5) add(day(between(1, 28)), "Cinema City", -between(1800, 4200), "Entertainment");
    if (rand() < 0.3) add(day(between(1, 28)), "Freelance design work", between(30000, 90000), "Other income");
  }
  // A refund, to show money coming back into a spending category.
  add(dateInMonth(addMonths(current, -1), 22), "Outdoor Gear Co refund", 4500, "Shopping");
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Loads sample categories, budgets, transactions and two recurring rules.
 * Safe to run twice: sample rows carry import keys and rules are matched by
 * description, so nothing is duplicated.
 */
export async function loadSampleData(db: BudgetDB, todayDate: string): Promise<number> {
  await seedCategories(db);
  return db.transaction("rw", db.categories, db.transactions, db.recurring, async () => {
    const categories = await db.categories.toArray();
    const ids = Object.fromEntries(categories.map((c) => [c.name, c.id]));
    await db.categories.bulkPut(categories.map((c): Category => (BUDGETS[c.name] ? { ...c, budget: BUDGETS[c.name]! } : c)));

    const now = Date.now();
    const drafts = sampleTransactions(ids, todayDate).map((d, i) => ({ ...d, importKey: `sample|${d.date}|${i}` }));
    const existing = new Set((await db.transactions.where("importKey").anyOf(drafts.map((d) => d.importKey)).toArray()).map((t) => t.importKey));
    const fresh = drafts.filter((d) => !existing.has(d.importKey));
    await db.transactions.bulkAdd(fresh.map((d, i) => ({ ...d, id: newId(), createdAt: now + i })));

    const current = monthOf(todayDate);
    const rules: RecurringRule[] = [
      { id: newId(), description: "Maple Street Apartments", amount: -140000, categoryId: ids.Housing ?? null, dayOfMonth: 1, startMonth: addMonths(current, -5), lastGenerated: current },
      {
        id: newId(),
        description: "Northwind Ltd payroll",
        amount: 410000,
        categoryId: ids.Salary ?? null,
        dayOfMonth: 28,
        startMonth: addMonths(current, -5),
        // This month's pay is only "generated" once the 28th has passed.
        lastGenerated: todayDate >= dateInMonth(current, 28) ? current : addMonths(current, -1),
      },
    ];
    const known = new Set((await db.recurring.toArray()).map((r) => r.description));
    await db.recurring.bulkAdd(rules.filter((r) => !known.has(r.description)));
    return fresh.length;
  });
}
