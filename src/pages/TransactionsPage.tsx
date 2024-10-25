import { Badge, Button, Checkbox, Group, Loader, Paper, Select, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDownload, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { MonthPicker } from "../components/month";
import { useMonth } from "../components/month-context";
import { TransactionForm } from "../components/TransactionForm";
import { db } from "../data/db";
import { useCategories, useTransactions } from "../data/hooks";
import { deleteTransactions, restoreTransactions, updateTransaction } from "../data/repo";
import { toCsv } from "../lib/csv";
import { formatDay } from "../lib/dates";
import { filterTransactions } from "../lib/filter";
import { formatMoney, sum } from "../lib/money";
import type { Transaction } from "../lib/types";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function TransactionsPage() {
  const { month } = useMonth();
  const transactions = useTransactions();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [allTime, setAllTime] = useState(false);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  const category = params.get("category");
  const shown = useMemo(
    () => filterTransactions(transactions ?? [], { month: allTime ? null : month, category, text }),
    [transactions, month, allTime, category, text],
  );

  if (!transactions || !categories) return <Loader />;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const categoryOptions = [
    { group: "Spending", items: categories.filter((c) => c.kind === "expense").map((c) => ({ value: c.id, label: c.name })) },
    { group: "Income", items: categories.filter((c) => c.kind === "income").map((c) => ({ value: c.id, label: c.name })) },
  ];
  const selectedRows = shown.filter((t) => selected.has(t.id));
  const allSelected = shown.length > 0 && selectedRows.length === shown.length;

  const removeSelected = async () => {
    const removed = selectedRows;
    await deleteTransactions(db, removed.map((t) => t.id));
    setSelected(new Set());
    const id = notifications.show({
      message: (
        <Group justify="space-between">
          <Text size="sm">
            Deleted {removed.length} {removed.length === 1 ? "transaction" : "transactions"}
          </Text>
          <Button
            size="compact-sm"
            variant="light"
            onClick={async () => {
              await restoreTransactions(db, removed);
              notifications.hide(id);
            }}
          >
            Undo
          </Button>
        </Group>
      ),
      autoClose: 8000,
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Transactions</Title>
        <Group>
          {!allTime && <MonthPicker />}
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
            Add
          </Button>
        </Group>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="Search"
          placeholder="Description, note or amount"
          leftSection={<IconSearch size={16} />}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          w={260}
        />
        <Select
          label="Category"
          placeholder="All categories"
          data={[{ group: "", items: [{ value: "none", label: "Uncategorized" }] }, ...categoryOptions]}
          value={category}
          onChange={(value) => setParams(value ? { category: value } : {})}
          clearable
          w={200}
        />
        <Switch label="All months" checked={allTime} onChange={(e) => setAllTime(e.currentTarget.checked)} mb={8} />
        <Button
          variant="default"
          ml="auto"
          leftSection={<IconDownload size={18} />}
          onClick={() => download(`transactions-${allTime ? "all" : month}.csv`, toCsv(shown, categories), "text/csv")}
          disabled={!shown.length}
        >
          Export CSV
        </Button>
      </Group>

      {selectedRows.length > 0 && (
        <Paper withBorder p="xs" radius="md">
          <Group>
            <Text size="sm" fw={500}>
              {selectedRows.length} selected
            </Text>
            <Select
              size="xs"
              placeholder="Set category…"
              aria-label="Set category for selected"
              data={categoryOptions}
              value={null}
              onChange={async (value) => {
                await Promise.all(selectedRows.map((t) => updateTransaction(db, t.id, { categoryId: value })));
                setSelected(new Set());
              }}
              w={180}
            />
            <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={() => void removeSelected()}>
              Delete
            </Button>
          </Group>
        </Paper>
      )}

      {shown.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text c="dimmed" ta="center">
            {transactions.length === 0 ? "No transactions yet. Add one, or import a CSV from your bank." : "Nothing matches these filters."}
          </Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
          <Table highlightOnHover verticalSpacing="sm" miw={720}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    indeterminate={selectedRows.length > 0 && !allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(shown.map((t) => t.id)))}
                  />
                </Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Select ${t.description}`}
                      checked={selected.has(t.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                    />
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>{formatDay(t.date)}</Table.Td>
                  <Table.Td>
                    <Text
                      component="button"
                      type="button"
                      onClick={() => setEditing(t)}
                      fw={500}
                      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                    >
                      {t.description}
                    </Text>
                    {t.note && (
                      <Text size="xs" c="dimmed">
                        {t.note}
                      </Text>
                    )}
                    {t.recurringId && (
                      <Badge size="xs" variant="light" color="gray" ml={6}>
                        Recurring
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      variant="unstyled"
                      placeholder="Uncategorized"
                      aria-label={`Category for ${t.description}`}
                      data={categoryOptions}
                      value={t.categoryId}
                      onChange={(value) => void updateTransaction(db, t.id, { categoryId: value })}
                      leftSection={t.categoryId && byId.get(t.categoryId) ? <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--mantine-color-${byId.get(t.categoryId)!.color}-6)` }} /> : undefined}
                      w={170}
                    />
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace" c={t.amount > 0 ? "mint.7" : undefined} style={{ whiteSpace: "nowrap" }}>
                    {formatMoney(t.amount, "USD", { sign: t.amount > 0 })}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={4}>
                  {shown.length} {shown.length === 1 ? "transaction" : "transactions"}
                </Table.Th>
                <Table.Th ta="right" ff="monospace">
                  {formatMoney(sum(shown.map((t) => t.amount)), "USD", { sign: true })}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </Paper>
      )}

      {editing && (
        <TransactionForm opened onClose={() => setEditing(null)} transaction={editing === "new" ? undefined : editing} />
      )}
    </Stack>
  );
}
