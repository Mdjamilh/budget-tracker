import { useLiveQuery } from "dexie-react-hooks";

import { db } from "./db";

/** Live views of the database: components re-render whenever the data changes, in any tab. */
export const useCategories = () => useLiveQuery(() => db.categories.orderBy("name").toArray(), []);

export const useTransactions = () => useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);

export const useRecurring = () => useLiveQuery(() => db.recurring.toArray(), []);
