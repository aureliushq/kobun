export type Theme = "light" | "dark" | "system";

const COOKIE_NAME = "theme";

export function getThemeFromRequest(request: Request): Theme {
	const cookieHeader = request.headers.get("Cookie") ?? "";
	const match = cookieHeader.match(
		new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
	);
	const value = match?.[1];
	if (value === "light" || value === "dark" || value === "system") {
		return value;
	}
	return "system";
}

export function serializeThemeCookie(theme: Theme): string {
	return `${COOKIE_NAME}=${theme}; Path=/; SameSite=Lax; Max-Age=31536000`;
}
