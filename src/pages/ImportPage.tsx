import { Alert, Badge, Button, FileButton, Group, List, Paper, Select, SimpleGrid, Stack, Switch, Table, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconFileUpload, IconShieldLock } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useMonth } from "../components/month-context";
import { db } from "../data/db";
import { importRows } from "../data/repo";
import { DATE_FORMATS, dataRows, guessDateFormat, guessMapping, readCsv, toTransactions, type ColumnMapping, type CsvTable, type DateFormat } from "../lib/csv";
import { formatDay, monthOf } from "../lib/dates";
import { formatMoney } from "../lib/money";

const MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_ROWS = 8;

type Loaded = { name: string; table: CsvTable };

export function ImportPage() {
  const navigate = useNavigate();
  const { setMonth } = useMonth();
  const [file, setFile] = useState<Loaded>();
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>("YYYY-MM-DD");
  const [flipSigns, setFlipSigns] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const load = async (picked: File | null) => {
    if (!picked) return;
    setProblem(undefined);
    if (picked.size > MAX_BYTES) return setProblem("That file is over 5 MB. Export a shorter date range from your bank.");
    const table = readCsv(await picked.text());
    if (!table.headers.length || !dataRows(table).length) return setProblem("That file has no rows. Is it a CSV export?");
    const guessed = guessMapping(table.headers);
    setMapping(guessed);
    setDateFormat((guessed.date !== undefined && guessDateFormat(dataRows(table).slice(0, 50).map((r) => r[guessed.date!] ?? ""))) || "YYYY-MM-DD");
    setFlipSigns(false);
    setFile({ name: picked.name, table });
  };

  const ready = mapping.date !== undefined && (mapping.amount !== undefined || mapping.debit !== undefined || mapping.credit !== undefined);
  const result = useMemo(() => (file && ready ? toTransactions(file.table, mapping, dateFormat, { flipSigns }) : undefined), [file, ready, mapping, dateFormat, flipSigns]);

  const columns = file?.table.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` })) ?? [];
  const pick = (field: keyof ColumnMapping, label: string, description?: string) => (
    <Select
      label={label}
      description={description}
      placeholder="Not in this file"
      data={columns}
      value={mapping[field] === undefined ? null : String(mapping[field])}
      onChange={(v) => setMapping((m) => ({ ...m, [field]: v === null ? undefined : Number(v) }))}
      clearable
    />
  );

  const run = async () => {
    if (!result?.rows.length) return;
    setBusy(true);
    try {
      const { added, duplicates, categorized } = await importRows(db, result.rows);
      notifications.show({
        color: "mint",
        title: `Imported ${added} ${added === 1 ? "transaction" : "transactions"}`,
        message: [duplicates && `${duplicates} already imported, skipped.`, categorized && `${categorized} categorized from your history.`].filter(Boolean).join(" ") || "Nothing was skipped.",
      });
      const latest = result.rows.map((r) => r.date).sort().at(-1);
      if (latest) setMonth(monthOf(latest));
      navigate("/transactions");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="lg" maw={960}>
      <div>
        <Title order={2}>Import from your bank</Title>
        <Text c="dimmed">Download a CSV of transactions from your bank's website, then open it here.</Text>
      </div>

      <Alert variant="light" color="mint" icon={<IconShieldLock size={18} />}>
        The file is read in your browser and never uploaded. Importing the same file twice won't create duplicates.
      </Alert>

      <Group>
        <FileButton onChange={(f) => void load(f)} accept=".csv,text/csv">
          {(props) => (
            <Button {...props} leftSection={<IconFileUpload size={18} />} variant={file ? "default" : "filled"}>
              {file ? "Choose another file" : "Choose CSV file"}
            </Button>
          )}
        </FileButton>
        {file && (
          <Text size="sm">
            {file.name} · {dataRows(file.table).length} rows
          </Text>
        )}
      </Group>
      {problem && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} role="alert">
          {problem}
        </Alert>
      )}

      {file && (
        <>
          <Paper withBorder p="lg" radius="md">
            <Title order={3} size="h4" mb="sm">
              Match the columns
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              {pick("date", "Date")}
              {pick("description", "Description")}
              <Select label="Date format" data={DATE_FORMATS} value={dateFormat} onChange={(v) => v && setDateFormat(v as DateFormat)} allowDeselect={false} />
              {pick("amount", "Amount", "One column, negative for money out")}
              {pick("debit", "Money out", "If your bank splits amounts")}
              {pick("credit", "Money in")}
            </SimpleGrid>
            <Switch
              mt="md"
              checked={flipSigns}
              onChange={(e) => setFlipSigns(e.currentTarget.checked)}
              label="Purchases are positive in this file"
              description="Some credit card exports list spending as positive numbers."
            />
          </Paper>

          {!ready ? (
            <Text c="dimmed">Choose the date column and an amount column to see a preview.</Text>
          ) : (
            result && (
              <Paper withBorder p="lg" radius="md">
                <Group justify="space-between" mb="sm">
                  <Title order={3} size="h4">
                    Preview
                  </Title>
                  <Group gap="xs">
                    <Badge color="mint" variant="light">
                      {result.rows.length} ready
                    </Badge>
                    {result.errors.length > 0 && (
                      <Badge color="red" variant="light">
                        {result.errors.length} with problems
                      </Badge>
                    )}
                  </Group>
                </Group>
                <div style={{ overflowX: "auto" }}>
                  <Table miw={520}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Line</Table.Th>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Description</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.rows.slice(0, PREVIEW_ROWS).map((r) => (
                        <Table.Tr key={r.importKey}>
                          <Table.Td c="dimmed">{r.line}</Table.Td>
                          <Table.Td>{formatDay(r.date)}</Table.Td>
                          <Table.Td>{r.description}</Table.Td>
                          <Table.Td ta="right" ff="monospace" c={r.amount > 0 ? "mint.7" : undefined}>
                            {formatMoney(r.amount, "USD", { sign: r.amount > 0 })}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
                {result.rows.length > PREVIEW_ROWS && (
                  <Text size="sm" c="dimmed" mt="xs">
                    and {result.rows.length - PREVIEW_ROWS} more
                  </Text>
                )}
                {result.errors.length > 0 && (
                  <Alert color="red" variant="light" mt="md" title="These rows will be skipped" icon={<IconAlertTriangle size={18} />}>
                    <List size="sm">
                      {result.errors.slice(0, 5).map((e) => (
                        <List.Item key={e.line}>
                          Line {e.line}: {e.message}
                        </List.Item>
                      ))}
                    </List>
                    {result.errors.length > 5 && <Text size="sm">and {result.errors.length - 5} more</Text>}
                  </Alert>
                )}
                <Group justify="flex-end" mt="md">
                  <Button onClick={() => void run()} loading={busy} disabled={!result.rows.length}>
                    Import {result.rows.length} {result.rows.length === 1 ? "transaction" : "transactions"}
                  </Button>
                </Group>
              </Paper>
            )
          )}
        </>
      )}
    </Stack>
  );
}
