import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EditorSaveControl } from "./editor-save-control"

/**
 * The one control that offers both targets (#107).
 *
 * Save and Save to GitHub differ in target and nothing else (ADR-0008), which
 * is why they are one button with a menu rather than two buttons. The
 * assertions are about what a writer can reach, read and press — and about the
 * one thing the chrome must never do, which is move.
 */

function control(
	overrides: Partial<Parameters<typeof EditorSaveControl>[0]> = {},
) {
	const onRun = vi.fn()
	const onTargetChange = vi.fn()
	const view = render(
		<EditorSaveControl
			disabled={false}
			onRun={onRun}
			onTargetChange={onTargetChange}
			runDisabled={false}
			target="save"
			{...overrides}
		/>,
	)
	return { ...view, onRun, onTargetChange }
}

const primary = () => screen.getByTestId("editor-save-primary")
const chooser = () =>
	screen.getByRole("button", { name: "Change what the save button does" })

describe("the primary button", () => {
	it("names the target it would run, and runs it", async () => {
		const user = userEvent.setup()
		const { onRun } = control()

		expect(primary()).toHaveAccessibleName("Save")

		await user.click(primary())
		expect(onRun).toHaveBeenCalledWith("save")
	})

	it("names and runs the other target once that is the chosen one", async () => {
		const user = userEvent.setup()
		const { onRun } = control({ target: "commit" })

		expect(primary()).toHaveAccessibleName("Save to GitHub")

		await user.click(primary())
		expect(onRun).toHaveBeenCalledWith("commit")
	})

	it("goes dead while the editor cannot act", () => {
		control({ disabled: true })

		expect(primary()).toBeDisabled()
	})

	it("goes dead when this target has nothing to do", () => {
		control({ runDisabled: true })

		expect(primary()).toBeDisabled()
	})

	// Whatever the button is doing, the writer can still switch which target it
	// is — otherwise the menu shuts every time an autosave lands mid-sentence,
	// and a Save with nothing to keep would trap them on it.
	it("leaves the chooser reachable in either case", () => {
		const { unmount } = control({ disabled: true })
		expect(chooser()).not.toBeDisabled()
		unmount()

		control({ runDisabled: true })
		expect(chooser()).not.toBeDisabled()
	})
})

describe("the menu that switches which target is primary", () => {
	// The difference between the two has to be legible where the choice is
	// made, not only in the docs.
	it("says what each target does, beside its name", async () => {
		const user = userEvent.setup()
		control()

		await user.click(chooser())

		const [save, commit] = await screen.findAllByRole("menuitemradio")
		expect(save).toHaveTextContent("Save")
		expect(save).toHaveTextContent("Nothing reaches GitHub")
		expect(commit).toHaveTextContent("Save to GitHub")
		expect(commit).toHaveTextContent("Commits this item to the repository")
	})

	it("shows which target is the primary today", async () => {
		const user = userEvent.setup()
		control({ target: "commit" })

		await user.click(chooser())

		const [save, commit] = await screen.findAllByRole("menuitemradio")
		expect(commit).toBeChecked()
		expect(save).not.toBeChecked()
	})

	// Choosing is not doing. The writer switches which action the button is,
	// then presses it — GitHub's own pattern, and what ADR-0008 describes.
	it("switches the primary without running anything", async () => {
		const user = userEvent.setup()
		const { onRun, onTargetChange } = control()

		await user.click(chooser())
		const [, commit] = await screen.findAllByRole("menuitemradio")
		await user.click(commit)

		expect(onTargetChange).toHaveBeenCalledWith("commit")
		expect(onRun).not.toHaveBeenCalled()
	})

	it("opens from the keyboard, like the buttons it replaces", async () => {
		const user = userEvent.setup()
		control()

		chooser().focus()
		await user.keyboard("{Enter}")

		expect(await screen.findAllByRole("menuitemradio")).toHaveLength(2)
	})
})

/**
 * Switching the primary must not change the header's width or reflow anything
 * around it. happy-dom has no layout engine, so the assertion is on the
 * structure that makes constant width true: every label the button can carry
 * shares one grid cell, and the cell is as wide as the longest of them whether
 * or not it is the one showing.
 */
describe("the width the primary button reserves", () => {
	const labels = () => within(primary()).getAllByTestId("editor-save-label")

	it("keeps every label it could carry in the one cell", () => {
		control()

		expect(labels().map((label) => label.textContent)).toEqual([
			"Save",
			"Save to GitHub",
		])
		for (const label of labels()) {
			expect(label).toHaveClass("col-start-1", "row-start-1")
		}
	})

	it("hides the labels it is not showing rather than removing them", () => {
		control()

		const [save, commit] = labels()
		expect(save).not.toHaveClass("invisible")
		expect(commit).toHaveClass("invisible")
		expect(commit).toHaveAttribute("aria-hidden", "true")
	})

	it("carries the same set of labels whichever target is primary", () => {
		const { unmount } = control()
		const before = labels().map((label) => label.textContent)
		unmount()

		control({ target: "commit" })
		expect(labels().map((label) => label.textContent)).toEqual(before)
	})
})
