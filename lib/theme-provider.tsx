import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

export type InterfaceColorMode = "system" | "original" | "vivid" | "colorful" | "deep" | "grayscale" | "custom";

export const INTERFACE_COLOR_MODES: Array<{ id: InterfaceColorMode; label: string; hint: string; preview: string }> = [
  { id: "system", label: "跟隨系統", hint: "依裝置目前的淺色或深色外觀自動調整", preview: "#64748B" },
  { id: "original", label: "原廠配色", hint: "清爽藍白，適合日間比賽紀錄", preview: "#1D5FA7" },
  { id: "vivid", label: "鮮豔配色", hint: "高辨識靛藍、暖橘與莓紅重點", preview: "#4F46E5" },
  { id: "colorful", label: "彩色配色", hint: "沉穩青綠搭配琥珀與莓紅提示", preview: "#007A5E" },
  { id: "deep", label: "深色模式", hint: "石墨藍黑與高可讀藍色重點，適合低光環境", preview: "#46A7FF" },
  { id: "grayscale", label: "灰階配色", hint: "中性紙張層次與低干擾資訊階層", preview: "#303030" },
  { id: "custom", label: "自訂配色", hint: "使用您指定的六位十六進位主色", preview: "#7C3AED" },
];

const THEME_STORAGE_KEY = "baseball-scorer-pro:interface-theme:v1";

export type InterfacePalette = typeof SchemeColors.light;

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  interfaceColorMode: InterfaceColorMode;
  setInterfaceColorMode: (mode: InterfaceColorMode) => void;
  customInterfaceColor: string;
  setCustomInterfaceColor: (color: string) => void;
  interfacePalette: InterfacePalette;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeHex(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : "#7C3AED";
}

function mixHex(start: string, end: string, weight = 0.5) {
  const clamp = Math.min(1, Math.max(0, weight));
  const parse = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [redA, greenA, blueA] = parse(start);
  const [redB, greenB, blueB] = parse(end);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * clamp).toString(16).padStart(2, "0");
  return `#${mix(redA, redB)}${mix(greenA, greenB)}${mix(blueA, blueB)}`.toUpperCase();
}

export function resolveInterfacePalette(scheme: ColorScheme, mode: InterfaceColorMode, customColor: string): InterfacePalette {
  const resolvedMode = mode === "system" ? "original" : mode;
  const resolvedScheme: ColorScheme = resolvedMode === "deep" ? "dark" : scheme;
  const base = SchemeColors[resolvedScheme];
  if (resolvedMode === "original") return base;
  if (resolvedMode === "vivid") return { ...base, primary: "#4F46E5", background: "#F6F7FF", surface: "#FFFFFF", foreground: "#171B3C", muted: "#59617E", border: "#CDD3F8", success: "#07866A", warning: "#E87516", error: "#D72F55" };
  if (resolvedMode === "colorful") return { ...base, primary: "#007A5E", background: "#EFFBF6", surface: "#FFFFFF", foreground: "#133B32", muted: "#55736B", border: "#B9E3D4", success: "#168461", warning: "#C97912", error: "#C13E60" };
  if (resolvedMode === "deep") return { ...base, primary: "#46A7FF", background: "#121721", surface: "#1C2532", foreground: "#F3F7FC", muted: "#A8B7C6", border: "#344456", success: "#46D6A5", warning: "#FFB44D", error: "#FF7485" };
  if (resolvedMode === "grayscale") return { ...base, primary: "#303030", background: "#F5F5F3", surface: "#FCFCFB", foreground: "#171717", muted: "#666664", border: "#D5D5D0", success: "#4E4E4C", warning: "#696967", error: "#252525" };
  if (resolvedMode === "custom") {
    const primary = normalizeHex(customColor);
    return {
      ...base,
      primary,
      background: mixHex(primary, "#FFFFFF", 0.95),
      surface: mixHex(primary, "#FFFFFF", 0.985),
      foreground: mixHex(primary, "#101827", 0.77),
      muted: mixHex(primary, "#526172", 0.65),
      border: mixHex(primary, "#FFFFFF", 0.8),
      success: mixHex(primary, "#13795B", 0.72),
      warning: mixHex(primary, "#C66B05", 0.78),
      error: mixHex(primary, "#C92A45", 0.72),
    };
  }
  return base;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);
  const [interfaceColorMode, setInterfaceColorModeState] = useState<InterfaceColorMode>("original");
  const [customInterfaceColor, setCustomInterfaceColorState] = useState("#7C3AED");
  const interfacePalette = useMemo(() => resolveInterfacePalette(colorScheme, interfaceColorMode, customInterfaceColor), [colorScheme, customInterfaceColor, interfaceColorMode]);

  const applyScheme = useCallback((scheme: ColorScheme, palette: InterfacePalette) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      Object.entries(palette).forEach(([token, value]) => root.style.setProperty(`--color-${token}`, value));
    }
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as { mode?: InterfaceColorMode; customColor?: string };
        if (parsed.mode && INTERFACE_COLOR_MODES.some((item) => item.id === parsed.mode)) {
          setInterfaceColorModeState(parsed.mode);
          setColorSchemeState(parsed.mode === "deep" ? "dark" : parsed.mode === "system" ? systemScheme : "light");
        }
        if (parsed.customColor) setCustomInterfaceColorState(normalizeHex(parsed.customColor));
      } catch {
        // Ignore stale or malformed local preference data.
      }
    });
  }, [systemScheme]);

  useEffect(() => {
    if (interfaceColorMode === "system") setColorSchemeState(systemScheme);
  }, [interfaceColorMode, systemScheme]);

  useEffect(() => {
    applyScheme(colorScheme, interfacePalette);
  }, [applyScheme, colorScheme, interfacePalette]);

  const persistTheme = useCallback((mode: InterfaceColorMode, color: string) => {
    void AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, customColor: normalizeHex(color) }));
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => setColorSchemeState(scheme), []);
  const setInterfaceColorMode = useCallback((mode: InterfaceColorMode) => {
    setInterfaceColorModeState(mode);
    setColorSchemeState(mode === "deep" ? "dark" : mode === "system" ? systemScheme : "light");
    persistTheme(mode, customInterfaceColor);
  }, [customInterfaceColor, persistTheme, systemScheme]);
  const setCustomInterfaceColor = useCallback((color: string) => {
    const normalized = normalizeHex(color);
    setCustomInterfaceColorState(normalized);
    persistTheme(interfaceColorMode, normalized);
  }, [interfaceColorMode, persistTheme]);

  const themeVariables = useMemo(() => vars({
    "color-primary": interfacePalette.primary,
    "color-background": interfacePalette.background,
    "color-surface": interfacePalette.surface,
    "color-foreground": interfacePalette.foreground,
    "color-muted": interfacePalette.muted,
    "color-border": interfacePalette.border,
    "color-success": interfacePalette.success,
    "color-warning": interfacePalette.warning,
    "color-error": interfacePalette.error,
  }), [interfacePalette]);

  const value = useMemo(() => ({ colorScheme, setColorScheme, interfaceColorMode, setInterfaceColorMode, customInterfaceColor, setCustomInterfaceColor, interfacePalette }), [colorScheme, customInterfaceColor, interfaceColorMode, interfacePalette, setColorScheme, setCustomInterfaceColor, setInterfaceColorMode]);

  return <ThemeContext.Provider value={value}><View style={[{ flex: 1 }, themeVariables]}>{children}</View></ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
