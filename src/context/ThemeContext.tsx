import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_LOCAL_KEY = "ah_theme_mode";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialMode(): ThemeMode {
  const raw = window.localStorage.getItem(THEME_LOCAL_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialMode());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme: ResolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(m.matches ? "dark" : "light");
    onChange();
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_LOCAL_KEY, mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      cycleMode: () =>
        setMode((prev) => (prev === "system" ? "dark" : prev === "dark" ? "light" : "system")),
    }),
    [mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx == null) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}

