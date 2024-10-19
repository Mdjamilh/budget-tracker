import { createContext, useContext } from "react";

import type { MonthKey } from "../lib/types";

export type MonthContextValue = { month: MonthKey; setMonth: (m: MonthKey) => void };

export const MonthContext = createContext<MonthContextValue | null>(null);

export function useMonth(): MonthContextValue {
  const value = useContext(MonthContext);
  if (!value) throw new Error("useMonth must be used inside <MonthProvider>");
  return value;
}
