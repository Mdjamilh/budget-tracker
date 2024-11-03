import { Button, Card, FileButton, Group, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconDatabaseImport, IconDownload, IconTrash, IconUpload } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { db } from "../data/db";
import { useCategories, useTransactions } from "../data/hooks";
import { exportBackup, restoreBackup, seedCategories } from "../data/repo";
import { loadSampleData } from "../data/sample";
import { toCsv } from "../lib/csv";
import { today } from "../lib/dates";
import { download } from "../lib/download";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Title order={3} size="h4">
        {title}
      </Title>
      <Text c="dimmed" size="sm" mt={4} mb="md">
        {description}
      </Text>
      <Group>{children}</Group>
    </Card>
  );
}

export function SettingsPage() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories() ?? [];

  const backup = async () => {
    const data = await exportBackup(db);
    download(`budget-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
  };

  const restore = (file: File | null) => {
    if (!file) return;
    modals.openConfirmModal({
      title: "Replace everything with this backup?",
      children: <Text size="sm">All current transactions, categories and recurring items will be replaced by the ones in {file.name}.</Text>,
      labels: { confirm: "Restore", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const result = await restoreBackup(db, JSON.parse(await file.text()));
          notifications.show({ color: "mint", title: "Backup restored", message: `${result.transactions} transactions and ${result.categories} categories.` });
        } catch (error) {
          notifications.show({ color: "red", title: "Couldn't restore", message: error instanceof SyntaxError ? "That file isn't valid JSON." : (error as Error).message });
        }
      },
    });
  };

  const wipe = () =>
    modals.openConfirmModal({
      title: "Delete all data?",
      children: <Text size="sm">This removes every transaction, category and recurring item from this browser. Download a backup first if you might want them back.</Text>,
      labels: { confirm: "Delete everything", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await db.transaction("rw", db.transactions, db.categories, db.recurring, async () => {
          await Promise.all([db.transactions.clear(), db.categories.clear(), db.recurring.clear()]);
        });
        await seedCategories(db);
        notifications.show({ message: "All data deleted." });
      },
    });

  return (
    <Stack gap="lg" maw={760}>
      <div>
        <Title order={2}>Settings</Title>
        <Text c="dimmed">
          Your {transactions.length} transactions are stored only in this browser. Back them up to move to another device or browser.
        </Text>
      </div>

      <Section title="Backup" description="A complete copy you can restore here or in another browser.">
        <Button leftSection={<IconDownload size={18} />} onClick={() => void backup()}>
          Download backup
        </Button>
        <FileButton onChange={restore} accept="application/json,.json">
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconUpload size={18} />}>
              Restore from backup
            </Button>
          )}
        </FileButton>
      </Section>

      <Section title="Export" description="Every transaction as a CSV, for spreadsheets or your accountant.">
        <Button variant="default" leftSection={<IconDownload size={18} />} disabled={!transactions.length} onClick={() => download("transactions.csv", toCsv(transactions, categories), "text/csv")}>
          Export all transactions
        </Button>
      </Section>

      <Section title="Sample data" description="Six months of example spending, to try things out. It's added alongside your own data.">
        <Button variant="default" leftSection={<IconDatabaseImport size={18} />} onClick={() => void loadSampleData(db, today())}>
          Add sample data
        </Button>
      </Section>

      <Section title="Delete all data" description="Start over with an empty budget.">
        <Button color="red" variant="light" leftSection={<IconTrash size={18} />} onClick={wipe}>
          Delete all data
        </Button>
      </Section>
    </Stack>
  );
}
