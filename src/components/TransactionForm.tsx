import { Button, Group, Modal, SegmentedControl, Select, Stack, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";

import { db } from "../data/db";
import { useCategories } from "../data/hooks";
import { addTransaction, updateTransaction } from "../data/repo";
import { suggestCategory } from "../lib/categorize";
import { today } from "../lib/dates";
import { parseAmount } from "../lib/money";
import type { Transaction } from "../lib/types";

type Values = { kind: "expense" | "income"; amount: string; date: string; description: string; categoryId: string | null; note: string };

const fromTransaction = (t?: Transaction): Values => ({
  kind: t && t.amount > 0 ? "income" : "expense",
  amount: t ? (Math.abs(t.amount) / 100).toFixed(2) : "",
  date: t?.date ?? today(),
  description: t?.description ?? "",
  categoryId: t?.categoryId ?? null,
  note: t?.note ?? "",
});

/** Add or edit one transaction. Amounts are typed as positive numbers; the toggle sets the direction. */
export function TransactionForm({ opened, onClose, transaction }: { opened: boolean; onClose: () => void; transaction?: Transaction }) {
  const categories = useCategories() ?? [];
  const form = useForm<Values>({
    mode: "controlled",
    initialValues: fromTransaction(transaction),
    validate: {
      amount: (v) => {
        const cents = parseAmount(v);
        if (cents === undefined) return "Enter an amount like 12.50";
        if (cents <= 0) return "Enter a positive amount and pick Expense or Income";
        return null;
      },
      date: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Pick a date"),
      description: (v) => (v.trim() ? null : "Describe what this was"),
    },
  });

  const kind = form.getValues().kind;
  const options = categories.filter((c) => c.kind === kind && !c.archived).map((c) => ({ value: c.id, label: c.name }));

  const submit = form.onSubmit(async (values) => {
    const cents = parseAmount(values.amount)!;
    const input = {
      date: values.date,
      description: values.description.trim(),
      amount: values.kind === "expense" ? -cents : cents,
      categoryId: values.categoryId,
      note: values.note.trim() || undefined,
    };
    if (transaction) await updateTransaction(db, transaction.id, input);
    else await addTransaction(db, input);
    onClose();
  });

  return (
    <Modal opened={opened} onClose={onClose} title={transaction ? "Edit transaction" : "Add transaction"} centered>
      <form onSubmit={submit}>
        <Stack>
          <SegmentedControl
            fullWidth
            data={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
            {...form.getInputProps("kind")}
            onChange={(value) => {
              form.setFieldValue("kind", value as Values["kind"]);
              form.setFieldValue("categoryId", null); // categories differ by kind
            }}
          />
          <Group grow align="flex-start">
            <TextInput label="Amount" placeholder="0.00" inputMode="decimal" leftSection="$" data-autofocus {...form.getInputProps("amount")} />
            <DateInput label="Date" valueFormat="MMM D, YYYY" maxDate={today()} {...form.getInputProps("date")} />
          </Group>
          <TextInput
            label="Description"
            placeholder="e.g. Fresh Market"
            {...form.getInputProps("description")}
            onBlur={async (e) => {
              // Suggest the category used last time for this merchant, if none is chosen yet.
              // Read history at this moment rather than from a subscription that may still be loading.
              const description = e.currentTarget.value;
              if (form.getValues().categoryId || !description.trim()) return;
              const suggestion = suggestCategory(description, await db.transactions.toArray());
              if (suggestion && options.some((o) => o.value === suggestion)) form.setFieldValue("categoryId", suggestion);
            }}
          />
          <Select label="Category" placeholder="Uncategorized" data={options} clearable searchable {...form.getInputProps("categoryId")} />
          <TextInput label="Note" placeholder="Optional" {...form.getInputProps("note")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{transaction ? "Save" : "Add"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
