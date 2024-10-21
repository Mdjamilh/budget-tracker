import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { createHashRouter, RouterProvider } from "react-router";

import { MonthProvider } from "./components/month";
import { Shell } from "./components/Shell";
import { db } from "./data/db";
import { runRecurring, seedCategories } from "./data/repo";
import { today } from "./lib/dates";

// Hash routes work offline from the service worker cache and on any static host.
const router = createHashRouter([
  {
    element: <Shell />,
    children: [{ index: true, element: <p>Overview</p> }],
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
    </MonthProvider>
  );
}
