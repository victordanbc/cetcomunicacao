import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppTheme, THEMES, ThemeMode } from "./theme";

const STORAGE_KEY = "cetcom:themeMode";

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [didLoad, setDidLoad] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value === "light" || value === "dark") setModeState(value);
      })
      .finally(() => {
        if (mounted) setDidLoad(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const theme = useMemo(() => THEMES[mode], [mode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const toggle = () => setMode(mode === "dark" ? "light" : "dark");

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      toggle
    }),
    [theme, mode]
  );

  if (!didLoad) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
