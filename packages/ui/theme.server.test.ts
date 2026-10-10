import { expect, test } from "vitest"
import { getThemeFromRequest, themeCookie } from "./theme.server"

const requestWith = (cookie: string) =>
	new Request("https://kobun.test/", { headers: { Cookie: cookie } })

test("reads back the theme it wrote", async () => {
	const setCookie = await themeCookie.serialize("dark")
	const cookie = setCookie.split(";")[0] ?? ""

	expect(await getThemeFromRequest(requestWith(cookie))).toBe("dark")
})

test("falls back to system when the cookie is missing or unreadable", async () => {
	expect(await getThemeFromRequest(new Request("https://kobun.test/"))).toBe(
		"system",
	)
	expect(await getThemeFromRequest(requestWith("theme=purple"))).toBe("system")
})
