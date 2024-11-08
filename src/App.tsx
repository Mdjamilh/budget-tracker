import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { createHashRouter, RouterProvider } from "react-router";

import { MonthProvider } from "./components/month";
import { Shell } from "./components/Shell";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { db } from "./data/db";
import { runRecurring, seedCategories } from "./data/repo";
import { today } from "./lib/dates";

// Hash routes work offline from the service worker cache and on any static host.
// Each page is its own chunk, so the charts only load on the overview.
const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { index: true, lazy: () => import("./pages/OverviewPage").then((m) => ({ Component: m.OverviewPage })) },
      { path: "transactions", lazy: () => import("./pages/TransactionsPage").then((m) => ({ Component: m.TransactionsPage })) },
      { path: "budgets", lazy: () => import("./pages/BudgetsPage").then((m) => ({ Component: m.BudgetsPage })) },
      { path: "recurring", lazy: () => import("./pages/RecurringPage").then((m) => ({ Component: m.RecurringPage })) },
      { path: "import", lazy: () => import("./pages/ImportPage").then((m) => ({ Component: m.ImportPage })) },
      { path: "settings", lazy: () => import("./pages/SettingsPage").then((m) => ({ Component: m.SettingsPage })) },
    ],
  },
]);

export default function App() {
  useEffect(() => {
    void (async () => {
      await seedCategories(db);
      const created = await runRecurring(db, today());
      if (created > 0) {
        notifications.show({ title: "Recurring transactions added", message: `${created} scheduled ${created === 1 ? "transaction was" : "transactions were"} due.` });
      }
    })();
  }, []);

  return (
    <MonthProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </MonthProvider>
  );
}
