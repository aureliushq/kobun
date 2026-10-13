import { renderToString } from "react-dom/server"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"
import type { Theme } from "@/ui/theme.server"
import { Layout } from "./root"

/**
 * The server-rendered theme class (#211).
 *
 * Only a stored `dark` theme can be known on the server. `system` waits for the
 * inline head script, which runs before first paint.
 *
 * `renderToString` rather than `render`: the bug is in server output, and
 * `render` cannot mount an `<html>` element.
 */

function htmlTag(theme: Theme) {
	const Stub = createRoutesStub([
		{ id: "root", path: "/", Component: () => <Layout>{null}</Layout> },
	])
	const html = renderToString(
		<Stub hydrationData={{ loaderData: { root: { theme } } }} />,
	)
	return html.match(/<html[^>]*>/)?.[0]
}

describe("Layout", () => {
	it("renders the dark class for the dark theme", () => {
		expect(htmlTag("dark")).toContain('class="dark"')
	})

	it.each<Theme>([
		"light",
		"system",
	])("renders no dark class for the %s theme", (theme) => {
		const tag = htmlTag(theme)
		expect(tag).not.toContain("class=")
		expect(tag).toContain(`data-theme="${theme}"`)
	})
})
