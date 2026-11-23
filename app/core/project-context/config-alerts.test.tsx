import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ConfigAlert } from "./config-alerts"
import { UNREADABLE_CONFIG } from "./config-errors"

/** Each Config error code earns its own title. */
describe("a Config error's alert", () => {
	it.each([
		["no_config", "", "Configuration file missing"],
		["parse_error", ".kobun.json", "Failed to parse config"],
		[UNREADABLE_CONFIG, "", "Couldn't read your configuration"],
		["invalid_type", "collections.posts", "Invalid config"],
	])("titles %s", (code, path, title) => {
		render(<ConfigAlert error={{ code, message: "boom", path }} />)
		expect(screen.getByText(title)).toBeInTheDocument()
		expect(screen.getByRole("alert")).toHaveTextContent("boom")
		if (path) expect(screen.getByRole("alert")).toHaveTextContent(path)
	})
})
