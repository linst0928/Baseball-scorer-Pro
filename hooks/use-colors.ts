import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useThemeContext } from "@/lib/theme-provider";

/**
 * Returns the current theme's color palette.
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const { interfacePalette } = useThemeContext();
  if (colorSchemeOverride) return Colors[colorSchemeOverride];
  return {
    ...interfacePalette,
    text: interfacePalette.foreground,
    tint: interfacePalette.primary,
    icon: interfacePalette.muted,
    tabIconDefault: interfacePalette.muted,
    tabIconSelected: interfacePalette.primary,
  };
}
