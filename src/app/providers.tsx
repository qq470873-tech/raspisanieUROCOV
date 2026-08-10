"use client";

import { ThemeProvider } from "next-themes";

/** Тема следует за настройкой устройства (светлая/тёмная). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
