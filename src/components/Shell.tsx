import { ActionIcon, AppShell, Burger, Group, NavLink, Text, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChartPie, IconFileImport, IconListDetails, IconMoon, IconRepeat, IconSettings, IconSun, IconTargetArrow } from "@tabler/icons-react";
import { NavLink as RouterLink, Outlet, useLocation } from "react-router";

const LINKS = [
  { to: "/", label: "Overview", icon: IconChartPie },
  { to: "/transactions", label: "Transactions", icon: IconListDetails },
  { to: "/budgets", label: "Budgets", icon: IconTargetArrow },
  { to: "/recurring", label: "Recurring", icon: IconRepeat },
  { to: "/import", label: "Import", icon: IconFileImport },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export function Shell() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <img src="/icon.svg" width={26} height={26} alt="" />
            <Text fw={700} size="lg">
              Budget
            </Text>
          </Group>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={`Switch to ${scheme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
          >
            {scheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" aria-label="Main">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            component={RouterLink}
            to={link.to}
            label={link.label}
            leftSection={<link.icon size={18} stroke={1.6} />}
            active={link.to === "/" ? pathname === "/" : pathname.startsWith(link.to)}
            onClick={close}
            variant="light"
            style={{ borderRadius: "var(--mantine-radius-md)" }}
          />
        ))}
        <Text size="xs" c="dimmed" mt="auto" p="xs">
          Your data is stored only in this browser.
        </Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
