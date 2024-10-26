import { ActionIcon, Button, ColorSwatch, Group, Loader, Menu, Modal, Paper, SegmentedControl, Stack, Switch, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconArchive, IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { db } from "../data/db";
import { useCategories } from "../data/hooks";
import { deleteCategory, saveCategory } from "../data/repo";
import { formatMoney, parseAmount, sum } from "../lib/money";
import type { Category } from "../lib/types";

const COLORS = ["teal", "cyan", "indigo", "blue", "green", "lime", "yellow", "orange", "red", "pink", "grape", "violet"];

/** Budget amount that saves when you leave the field, and explains bad input in place. */
function BudgetInput({ category }: { category: Category }) {
  const [value, setValue] = useState(category.budget ? (category.budget / 100).toFixed(2) : "");
  const [error, setError] = useState<string>();

  const save = async () => {
    const cents = value.trim() ? parseAmount(value) : 0;
    if (cents === undefined || cents < 0) return setError("Enter an amount like 250");
    setError(undefined);
    if (cents !== category.budget) await saveCategory(db, { ...category, budget: cents });
    setValue(cents ? (cents / 100).toFixed(2) : "");
  };

  return (
    <TextInput
      size="xs"
      w={130}
      leftSection="$"
      placeholder="No budget"
      inputMode="decimal"
      aria-label={`Monthly budget for ${category.name}`}
      value={value}
      error={error}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function NewCategory({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const form = useForm({
    initialValues: { name: "", kind: "expense" as Category["kind"], color: "blue" },
    validate: { name: (v) => (v.trim() ? null : "Give it a name") },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="New category" centered>
      <form
        onSubmit={form.onSubmit(async (v) => {
          await saveCategory(db, { name: v.name.trim(), kind: v.kind, color: v.color, budget: 0 });
          form.reset();
          onClose();
        })}
      >
        <Stack>
          <SegmentedControl data={[{ value: "expense", label: "Spending" }, { value: "income", label: "Income" }]} {...form.getInputProps("kind")} />
          <TextInput label="Name" data-autofocus {...form.getInputProps("name")} />
          <div>
            <Text size="sm" fw={500} mb={6}>
              Color
            </Text>
            <Group gap={6}>
              {COLORS.map((c) => (
                <ColorSwatch
                  key={c}
                  component="button"
                  type="button"
                  color={`var(--mantine-color-${c}-6)`}
                  aria-label={c}
                  aria-pressed={form.values.color === c}
                  onClick={() => form.setFieldValue("color", c)}
                  style={{ outline: form.values.color === c ? "2px solid var(--mantine-color-text)" : undefined, outlineOffset: 2 }}
                />
              ))}
            </Group>
          </div>
          <Group justify="flex-end">
            <Button type="submit">Create</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function BudgetsPage() {
  const categories = useCategories();
  const [adding, setAdding] = useState(false);
  if (!categories) return <Loader />;

  const remove = (c: Category) =>
    modals.openConfirmModal({
      title: `Delete "${c.name}"?`,
      children: <Text size="sm">Its transactions are kept and become uncategorized. If you only want to hide it from budgets, archive it instead.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => void deleteCategory(db, c.id),
    });

  const section = (kind: Category["kind"], title: string) => {
    const rows = categories.filter((c) => c.kind === kind).sort((a, b) => Number(a.archived ?? false) - Number(b.archived ?? false) || a.name.localeCompare(b.name));
    return (
      <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
        <Table verticalSpacing="sm" miw={560}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{title}</Table.Th>
              {kind === "expense" && <Table.Th>Monthly budget</Table.Th>}
              {kind === "expense" && (
                <Table.Th>
                  <Tooltip label="Bills paid once a month, like rent. They never get 'spending fast' warnings.">
                    <span>Fixed bill</span>
                  </Tooltip>
                </Table.Th>
              )}
              <Table.Th w={50} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((c) => (
              <Table.Tr key={c.id} opacity={c.archived ? 0.55 : 1}>
                <Table.Td>
                  <Group gap="sm">
                    <ColorSwatch color={`var(--mantine-color-${c.color}-6)`} size={14} />
                    <Text fw={500}>{c.name}</Text>
                    {c.archived && (
                      <Text size="xs" c="dimmed">
                        Archived
                      </Text>
                    )}
                  </Group>
                </Table.Td>
                {kind === "expense" && (
                  <Table.Td>
                    <BudgetInput category={c} />
                  </Table.Td>
                )}
                {kind === "expense" && (
                  <Table.Td>
                    <Switch aria-label={`${c.name} is a fixed bill`} checked={c.fixed ?? false} onChange={(e) => void saveCategory(db, { ...c, fixed: e.currentTarget.checked })} />
                  </Table.Td>
                )}
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${c.name}`}>
                        <IconDots size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconArchive size={16} />} onClick={() => void saveCategory(db, { ...c, archived: !c.archived })}>
                        {c.archived ? "Unarchive" : "Archive"}
                      </Menu.Item>
                      <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => remove(c)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    );
  };

  const total = sum(categories.filter((c) => c.kind === "expense" && !c.archived).map((c) => c.budget));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Budgets</Title>
          <Text c="dimmed">Monthly budgets total {formatMoney(total)}. Changes apply to every month.</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setAdding(true)}>
          New category
        </Button>
      </Group>
      {section("expense", "Spending")}
      {section("income", "Income")}
      <NewCategory opened={adding} onClose={() => setAdding(false)} />
    </Stack>
  );
}
