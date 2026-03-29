export const FONTS = {
  semibold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extrabold: "Montserrat_800ExtraBold"
} as const;

export type ThemeMode = "light" | "dark";

export type AppTheme = {
  mode: ThemeMode;
  colors: {
    primary: string;
    onPrimary: string;
    background: string;
    surface: string;
    surface2: string;
    text: string;
    muted: string;
    border: string;
    shadow: string;
    accent: string;
  };
};

export const THEMES: Record<ThemeMode, AppTheme> = {
  light: {
    mode: "light",
    colors: {
      primary: "#0d47a1",
      onPrimary: "#ffffff",
      background: "#f0f4fa",
      surface: "#ffffff",
      surface2: "#e3f2fd",
      text: "#0d1b2a",
      muted: "#546e7a",
      border: "rgba(13, 27, 42, 0.08)",
      shadow: "rgba(2, 12, 27, 0.12)",
      accent: "#00acc1"
    }
  },
  dark: {
    mode: "dark",
    colors: {
      primary: "#42a5f5",
      onPrimary: "#0d1b2a",
      background: "#0b1419",
      surface: "#152028",
      surface2: "#1e2a35",
      text: "rgba(255,255,255,0.92)",
      muted: "rgba(255,255,255,0.55)",
      border: "rgba(255,255,255,0.08)",
      shadow: "rgba(0,0,0,0.4)",
      accent: "#4dd0e1"
    }
  }
};
