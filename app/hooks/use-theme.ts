import { createContext, useCallback, useContext, useEffect } from "react";
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
	if (
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches)
	) {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
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

	useEffect(() => {
		applyThemeToDOM(theme);
	}, [theme]);

	useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => applyThemeToDOM("system");
		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, [theme]);

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

	return { theme, setTheme };
}
