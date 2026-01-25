import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
} from "@fluentui/react-components";
import { preferencesQueries } from "@/api/queries/preferences";
import { useSystemTheme } from "@/hooks/useSystemTheme";
import { useAuth } from "@/auth/provider";

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Default values when no preferences are loaded yet
const DEFAULT_THEME = "system";
const DEFAULT_ACCENT = "#0078d4";
const DEFAULT_GUI_SCALE = 1.0;

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth();
  const { data: preferences } = useQuery({
    ...preferencesQueries.user,
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const systemIsDark = useSystemTheme();

  // Cast preferences to typed version
  const prefs = preferences as
    | {
        theme?: string;
        accentColor?: string;
        guiScale?: number;
      }
    | undefined;

  // Get values from database preferences or use defaults
  const theme = (prefs?.theme as "system" | "light" | "dark") || DEFAULT_THEME;
  const accentColor = prefs?.accentColor || DEFAULT_ACCENT;
  const guiScale = prefs?.guiScale || DEFAULT_GUI_SCALE;

  // Apply GUI scale to document root
  useEffect(() => {
    // Base font size is 16px, scale it
    const baseFontSize = 16;
    const scaledFontSize = baseFontSize * guiScale;
    document.documentElement.style.fontSize = `${scaledFontSize}px`;

    // Also set a CSS variable for components that need pixel values
    document.documentElement.style.setProperty("--gui-scale", String(guiScale));

    return () => {
      document.documentElement.style.fontSize = "";
      document.documentElement.style.removeProperty("--gui-scale");
    };
  }, [guiScale]);

  // Determine dark mode based on theme preference from database
  let isDarkMode: boolean;
  if (theme === "light") {
    isDarkMode = false;
  } else if (theme === "dark") {
    isDarkMode = true;
  } else {
    // "system" - use system preference
    isDarkMode = systemIsDark;
  }

  const baseTheme = isDarkMode ? webDarkTheme : webLightTheme;
  const customTheme = {
    ...baseTheme,
    colorBrandBackground: accentColor,
    colorBrandBackgroundHover: accentColor,
    colorBrandBackgroundPressed: accentColor,
    colorCompoundBrandBackground: accentColor,
    colorCompoundBrandBackgroundHover: accentColor,
    colorCompoundBrandBackgroundPressed: accentColor,
    colorBrandForeground1: accentColor,
    colorBrandForeground2: accentColor,
    colorBrandStroke1: accentColor,
    colorBrandStroke2: accentColor,
    // Subtle button hover/pressed colors (used in window toolbar)
    colorSubtleBackgroundHover: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
    colorSubtleBackgroundPressed: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
    colorNeutralForeground2BrandHover: accentColor,
    colorNeutralForeground2BrandPressed: accentColor,
    // Transparent button hover/pressed colors
    colorTransparentBackgroundHover: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
    colorTransparentBackgroundPressed: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
    // Tab/compound brand colors (for selected tab indicator)
    colorCompoundBrandStroke: accentColor,
    colorCompoundBrandStrokeHover: accentColor,
    colorCompoundBrandStrokePressed: accentColor,
    colorCompoundBrandForeground1: accentColor,
    colorCompoundBrandForeground1Hover: accentColor,
    colorCompoundBrandForeground1Pressed: accentColor,
  };

  return <FluentProvider theme={customTheme}>{children}</FluentProvider>;
}
