import { BarChart, DonutChart } from "@mantine/charts";
import { Badge, Button, Card, Group, Loader, Paper, Progress, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconDatabaseImport, IconFileImport } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { MonthPicker } from "../components/month";
import { useMonth } from "../components/month-context";
import { db } from "../data/db";
import { useCategories, useTransactions } from "../data/hooks";
import { loadSampleData } from "../data/sample";
import { monthlyTotals, summarizeMonth, type BudgetStatus, type CategorySpend } from "../lib/budget";
import { addMonths, formatMonth, monthsBetween, today } from "../lib/dates";
import { formatCompact, formatMoney, percent } from "../lib/money";

const STATUS: Record<BudgetStatus, { color: string; label: string }> = {
  none: { color: "gray", label: "No budget" },
  ok: { color: "mint", label: "On track" },
  ahead: { color: "yellow", label: "Spending fast" },
  over: { color: "red", label: "Over budget" },
};

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <Paper withBorder p="md" radius="md" role="group" aria-label={label}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={26} fw={700} c={color} ff="monospace">
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

function BudgetRow({ row }: { row: CategorySpend }) {
  const status = STATUS[row.status];
  const used = row.budget > 0 ? Math.min(100, percent(row.spent, row.budget)) : 0;
  return (
    <div>
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Group gap={8} wrap="nowrap">
          <span style={{ width: 10, height: 10, borderRadius: 999, background: `var(--mantine-color-${row.category.color}-6)` }} />
          <Text fw={500}>{row.category.name}</Text>
          {row.status !== "ok" && row.status !== "none" && (
            // The bar and the "over" line carry the same message on small screens.
            <Badge size="sm" variant="light" color={status.color} visibleFrom="sm">
              {status.label}
            </Badge>
          )}
        </Group>
        <Text size="sm" ff="monospace" ta="right">
          {formatMoney(Math.max(0, row.spent))}
          {row.budget > 0 && <Text span c="dimmed"> / {formatMoney(row.budget)}</Text>}
        </Text>
      </Group>
      {row.budget > 0 && (
        <>
          <Progress value={used} color={status.color} size="md" aria-label={`${row.category.name}: ${percent(row.spent, row.budget)}% of budget used`} />
          <Text size="xs" c={row.remaining < 0 ? "red" : "dimmed"} mt={2}>
            {row.remaining < 0 ? `${formatMoney(-row.remaining)} over` : `${formatMoney(Math.min(row.remaining, row.budget))} left`}
          </Text>
        </>
      )}
      {/* Refunds for earlier purchases can outweigh this month's spending. */}
      {row.spent < 0 && (
        <Text size="xs" c="mint.7" mt={2}>
          {formatMoney(-row.spent)} more refunded than spent
        </Text>
      )}
    </div>
  );
}

function Welcome() {
  const [loading, setLoading] = useState(false);
  return (
    <Card withBorder radius="md" p="xl" maw={640}>
      <Title order={2}>Welcome to Budget</Title>
      <Text c="dimmed" mt="xs">
        Track where your money goes and set monthly budgets. Everything stays in this browser: there's no account, and nothing is sent anywhere.
      </Text>
      <Group mt="lg">
        <Button
          leftSection={<IconDatabaseImport size={18} />}
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await loadSampleData(db, today());
            setLoading(false);
          }}
        >
          Explore with sample data
        </Button>
        <Button component={Link} to="/import" variant="default" leftSection={<IconFileImport size={18} />}>
          Import a bank CSV
        </Button>
        <Button component={Link} to="/transactions" variant="subtle">
          Start from scratch
        </Button>
      </Group>
    </Card>
  );
}

export function OverviewPage() {
  const { month } = useMonth();
  const transactions = useTransactions();
  const categories = useCategories();

  const data = useMemo(() => {
    if (!transactions || !categories) return undefined;
    const summary = summarizeMonth(transactions, categories, month, today());
    const trend = monthlyTotals(transactions, categories, monthsBetween(addMonths(month, -5), month));
    const donut = summary.categories
      .filter((c) => c.spent > 0)
      .map((c) => ({ name: c.category.name, value: c.spent / 100, color: `${c.category.color}.6` }));
    if (summary.uncategorized > 0) donut.push({ name: "Uncategorized", value: summary.uncategorized / 100, color: "gray.5" });
    return { summary, trend, donut };
  }, [transactions, categories, month]);

  if (!data) return <Loader />;
  if (transactions!.length === 0) return <Welcome />;

  const { summary, trend, donut } = data;
  const left = summary.budgeted - summary.spentAgainstBudget;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Overview</Title>
        <MonthPicker />
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label="Income" value={formatMoney(summary.income)} color="mint" />
        <Stat label="Spending" value={formatMoney(summary.expenses)} />
        <Stat label="Net" value={formatMoney(summary.net, "USD", { sign: true })} color={summary.net < 0 ? "red" : undefined} hint={summary.income > 0 ? `${percent(summary.net, summary.income)}% saved` : undefined} />
        <Stat
          label="Budget left"
          value={summary.budgeted ? formatMoney(left) : "—"}
          color={left < 0 ? "red" : undefined}
          hint={summary.budgeted ? `${percent(summary.spentAgainstBudget, summary.budgeted)}% of ${formatMoney(summary.budgeted)} used` : "Set budgets on the Budgets page"}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Title order={3} size="h4" mb="md">
            Budgets
          </Title>
          <Stack gap="md">
            {summary.categories.length ? summary.categories.map((row) => <BudgetRow key={row.category.id} row={row} />) : <Text c="dimmed">No spending this month.</Text>}
            {summary.uncategorized > 0 && (
              <Text size="sm" c="dimmed">
                Plus {formatMoney(summary.uncategorized)} uncategorized. <Link to="/transactions?category=none">Sort it out</Link>
              </Text>
            )}
          </Stack>
        </Card>

        <Stack>
          <Card withBorder radius="md" p="lg">
            <Title order={3} size="h4" mb="md">
              Where it went
            </Title>
            {donut.length ? (
              <Group justify="center">
                <DonutChart data={donut} size={180} thickness={26} withTooltip tooltipDataSource="segment" valueFormatter={(v) => formatMoney(Math.round(v * 100))} chartLabel={formatCompact(summary.expenses)} />
              </Group>
            ) : (
              <Text c="dimmed">No spending this month.</Text>
            )}
          </Card>
          <Card withBorder radius="md" p="lg">
            <Title order={3} size="h4" mb="md">
              Last 6 months
            </Title>
            <BarChart
              h={200}
              data={trend.map((t) => ({ month: formatMonth(t.month, "short").slice(0, 3), Income: t.income / 100, Spending: t.expenses / 100 }))}
              dataKey="month"
              series={[
                { name: "Income", color: "mint.6" },
                { name: "Spending", color: "gray.5" },
              ]}
              valueFormatter={(v) => formatCompact(Math.round(v * 100))}
              withLegend
              tickLine="none"
            />
          </Card>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
