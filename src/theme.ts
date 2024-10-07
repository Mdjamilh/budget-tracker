import { createTheme, type MantineColorsTuple } from "@mantine/core";

// A calm green for money in, used as the primary color.
const mint: MantineColorsTuple = [
  "#e6fcf3",
  "#d4f4e6",
  "#aae7cc",
  "#7cd9b0",
  "#56cd98",
  "#3dc589",
  "#2ec180",
  "#1eaa6d",
  "#0f975f",
  "#00834f",
];

export const theme = createTheme({
  primaryColor: "mint",
  colors: { mint },
  fontFamily: "Manrope, system-ui, -apple-system, Segoe UI, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, ui-monospace, Consolas, monospace",
  headings: { fontFamily: "Manrope, system-ui, sans-serif", fontWeight: "700" },
  defaultRadius: "md",
  cursorType: "pointer",
});
