import { createCookie } from "react-router"

export type Theme = "light" | "dark" | "system"

export const themeCookie = createCookie("theme", {
	maxAge: 31536000,
	path: "/",
	sameSite: "lax",
})

export async function getThemeFromRequest(request: Request): Promise<Theme> {
	const value = await themeCookie.parse(request.headers.get("Cookie"))
	if (value === "light" || value === "dark" || value === "system") {
		return value
	}
	return "system"
}
