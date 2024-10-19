import { ActionIcon, Group, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import { addMonths, formatMonth, monthOf, today } from "../lib/dates";
import { MonthContext, useMonth } from "./month-context";

/** The month every page is looking at, shared so switching pages keeps it. */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(() => monthOf(today()));
  return <MonthContext value={{ month, setMonth }}>{children}</MonthContext>;
}

export function MonthPicker() {
  const { month, setMonth } = useMonth();
  const isCurrent = month === monthOf(today());
  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" color="gray" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
        <IconChevronLeft size={18} />
      </ActionIcon>
      <Text fw={600} w={140} ta="center" aria-live="polite">
        {formatMonth(month)}
      </Text>
      <ActionIcon variant="subtle" color="gray" aria-label="Next month" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))}>
        <IconChevronRight size={18} />
      </ActionIcon>
    </Group>
  );
}
