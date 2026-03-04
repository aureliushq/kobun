import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useSyncExternalStore,
} from "react";
import { useFetcher } from "react-router";
import type { Theme } from "~/lib/theme.server";

interface ThemeContextValue {
	theme: Theme;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
	undefined,
);

function applyThemeToDOM(theme: Theme) {
	const root = document.documentElement;
	root.setAttribute("data-theme", theme);
	if (isDark(theme)) {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
}

function isDark(theme: Theme): boolean {
	return (
		theme === "dark" ||
		(theme === "system" &&
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches)
	);
}

const darkMediaQuery =
	typeof window !== "undefined"
		? window.matchMedia("(prefers-color-scheme: dark)")
		: null;

function subscribeToMediaQuery(callback: () => void) {
	darkMediaQuery?.addEventListener("change", callback);
	return () => darkMediaQuery?.removeEventListener("change", callback);
}

function getPrefersDark() {
	return darkMediaQuery?.matches ?? false;
}

function getServerPrefersDark() {
	return false;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}

	const fetcher = useFetcher();

	const optimisticTheme = fetcher.formData
		? (fetcher.formData.get("theme") as Theme)
		: null;

	const theme = optimisticTheme ?? context.theme;

	const prefersDark = useSyncExternalStore(
		subscribeToMediaQuery,
		getPrefersDark,
		getServerPrefersDark,
	);

	const resolvedTheme: "light" | "dark" =
		theme === "system" ? (prefersDark ? "dark" : "light") : theme;

	// biome-ignore lint/correctness/useExhaustiveDependencies: it's fine
	useEffect(() => {
		applyThemeToDOM(theme);
	}, [theme, resolvedTheme]);

	const setTheme = useCallback(
		(newTheme: Theme) => {
			applyThemeToDOM(newTheme);
			fetcher.submit(
				{ theme: newTheme },
				{ method: "POST", action: "/api/set-theme" },
			);
		},
		[fetcher],
	);

	return { theme, resolvedTheme, setTheme };
}
