import { ActionIcon, Button, Group, Loader, Modal, NumberInput, Paper, SegmentedControl, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { db } from "../data/db";
import { useCategories, useRecurring } from "../data/hooks";
import { deleteRecurring, runRecurring, saveRecurring } from "../data/repo";
import { formatDay, monthOf, today } from "../lib/dates";
import { formatMoney, parseAmount } from "../lib/money";
import { nextDue } from "../lib/recurring";
import type { RecurringRule } from "../lib/types";

type Values = { kind: "expense" | "income"; description: string; amount: string; categoryId: string | null; dayOfMonth: number; startMonth: string; endMonth: string | null };

/** Month pickers work with "YYYY-MM-DD"; rules store "YYYY-MM". */
const toMonthValue = (month?: string) => (month ? `${month}-01` : null);

function RuleForm({ rule, onClose }: { rule?: RecurringRule; onClose: () => void }) {
  const categories = useCategories() ?? [];
  const form = useForm<Values>({
    initialValues: {
      kind: rule && rule.amount > 0 ? "income" : "expense",
      description: rule?.description ?? "",
      amount: rule ? (Math.abs(rule.amount) / 100).toFixed(2) : "",
      categoryId: rule?.categoryId ?? null,
      dayOfMonth: rule?.dayOfMonth ?? 1,
      startMonth: toMonthValue(rule?.startMonth) ?? `${monthOf(today())}-01`,
      endMonth: toMonthValue(rule?.endMonth),
    },
    validate: {
      description: (v) => (v.trim() ? null : "Describe it, e.g. Rent"),
      amount: (v) => ((parseAmount(v) ?? 0) > 0 ? null : "Enter a positive amount"),
      endMonth: (v, values) => (v && v < values.startMonth ? "Ends before it starts" : null),
    },
  });
  const options = categories.filter((c) => c.kind === form.values.kind && !c.archived).map((c) => ({ value: c.id, label: c.name }));

  return (
    <Modal opened onClose={onClose} title={rule ? "Edit recurring transaction" : "New recurring transaction"} centered>
      <form
        onSubmit={form.onSubmit(async (v) => {
          const cents = parseAmount(v.amount)!;
          const startMonth = v.startMonth.slice(0, 7);
          await saveRecurring(db, {
            id: rule?.id,
            description: v.description.trim(),
            amount: v.kind === "expense" ? -cents : cents,
            categoryId: v.categoryId,
            dayOfMonth: v.dayOfMonth,
            startMonth,
            endMonth: v.endMonth?.slice(0, 7),
            // Moving the start earlier on an existing rule shouldn't recreate months it already made.
            lastGenerated: rule?.lastGenerated && rule.lastGenerated >= startMonth ? rule.lastGenerated : undefined,
          });
          await runRecurring(db, today());
          onClose();
        })}
      >
        <Stack>
          <SegmentedControl data={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} {...form.getInputProps("kind")} />
          <TextInput label="Description" placeholder="e.g. Rent" data-autofocus {...form.getInputProps("description")} />
          <Group grow align="flex-start">
            <TextInput label="Amount" leftSection="$" inputMode="decimal" {...form.getInputProps("amount")} />
            <NumberInput label="Day of month" min={1} max={31} clampBehavior="strict" description="31 means the last day" {...form.getInputProps("dayOfMonth")} />
          </Group>
          <Select label="Category" placeholder="Uncategorized" data={options} clearable {...form.getInputProps("categoryId")} />
          <Group grow align="flex-start">
            <MonthPickerInput label="Starts" {...form.getInputProps("startMonth")} />
            <MonthPickerInput label="Ends" placeholder="Never" clearable {...form.getInputProps("endMonth")} />
          </Group>
          <Text size="xs" c="dimmed">
            Transactions are added automatically when their day arrives, including any months missed while the app was closed.
          </Text>
          <Group justify="flex-end">
            <Button type="submit">Save</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function RecurringPage() {
  const rules = useRecurring();
  const categories = useCategories();
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  if (!rules || !categories) return <Loader />;
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const remove = (rule: RecurringRule) =>
    modals.openConfirmModal({
      title: `Stop "${rule.description}"?`,
      children: <Text size="sm">No new transactions will be created. Ones already added stay.</Text>,
      labels: { confirm: "Stop", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => void deleteRecurring(db, rule.id),
    });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Recurring</Title>
          <Text c="dimmed">Rent, salary and subscriptions, added for you each month.</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
          New
        </Button>
      </Group>

      {rules.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text c="dimmed" ta="center">
            Nothing scheduled yet.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
          <Table verticalSpacing="sm" miw={600}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Description</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Next</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((r) => {
                const next = nextDue(r);
                return (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={500}>{r.description}</Table.Td>
                    <Table.Td>{r.categoryId ? names.get(r.categoryId) : <Text c="dimmed">Uncategorized</Text>}</Table.Td>
                    <Table.Td>{next ? formatDay(next) : <Text c="dimmed">Ended</Text>}</Table.Td>
                    <Table.Td ta="right" ff="monospace" c={r.amount > 0 ? "mint.7" : undefined}>
                      {formatMoney(r.amount, "USD", { sign: r.amount > 0 })}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon variant="subtle" color="gray" aria-label={`Edit ${r.description}`} onClick={() => setEditing(r)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" aria-label={`Stop ${r.description}`} onClick={() => remove(r)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      {editing && <RuleForm rule={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
