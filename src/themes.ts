export const THEME_STORAGE_KEY = "openbook.theme";
export const THEME_MODE_STORAGE_KEY = "openbook.themeMode";

export const THEMES = [
    {
        id: "editor",
        name: "Editor",
        className: "theme-editor",
    },
    {
        id: "neutral",
        name: "Neutral",
        className: "theme-neutral",
    },
    {
        id: "paper",
        name: "Paper",
        className: "theme-paper",
    },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME_ID: ThemeId = "editor";
export const DEFAULT_THEME_MODE: ThemeMode = "dark";

export function isThemeId(value: string | null): value is ThemeId {
    return THEMES.some((theme) => theme.id === value);
}

export function isThemeMode(value: string | null): value is ThemeMode {
    return value === "light" || value === "dark";
}
