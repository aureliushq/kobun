import { expect, test } from "vitest"
import { DateDisplay, EditorFont, EditorWidth } from "@/db/types"
import { parsePreferenceUpdate } from "./preference-update"

function submit(key: string, value: string) {
	const formData = new FormData()
	formData.set("key", key)
	formData.set("value", value)
	return parsePreferenceUpdate(formData)
}

test("a writer switching a panel off says so in a patch", () => {
	expect(submit("propertiesPanelOpen", "false")).toEqual({
		propertiesPanelOpen: false,
	})
	expect(submit("sidebarOpen", "true")).toEqual({ sidebarOpen: true })
	expect(submit("wordCountVisible", "false")).toEqual({
		wordCountVisible: false,
	})
})

test("a writer choosing from a list gets the value that list offered", () => {
	expect(submit("dateDisplay", DateDisplay.ABSOLUTE)).toEqual({
		dateDisplay: DateDisplay.ABSOLUTE,
	})
	expect(submit("editorFont", EditorFont.SERIF)).toEqual({
		editorFont: EditorFont.SERIF,
	})
	expect(submit("editorWidth", EditorWidth.WIDE)).toEqual({
		editorWidth: EditorWidth.WIDE,
	})
})

test("a value outside its vocabulary is refused rather than stored", () => {
	expect(submit("editorWidth", "enormous")).toBeNull()
	expect(submit("editorFont", "comic")).toBeNull()
	expect(submit("dateDisplay", "someday")).toBeNull()
	expect(submit("propertiesPanelOpen", "yes")).toBeNull()
})

test("a Preference nobody has is refused", () => {
	expect(submit("theme", "dark")).toBeNull()
	expect(submit("editorPrimaryAction", "commit")).toBeNull()
})

test("a submission missing its key or value is refused", () => {
	expect(parsePreferenceUpdate(new FormData())).toBeNull()

	const keyOnly = new FormData()
	keyOnly.set("key", "sidebarOpen")
	expect(parsePreferenceUpdate(keyOnly)).toBeNull()
})

test("a writer stating no preference clears the column rather than writing an empty string", () => {
	expect(submit("locale", "")).toEqual({ locale: null })
	expect(submit("timezone", "")).toEqual({ timezone: null })
})

test("a locale is stored in the spelling Intl agrees on", () => {
	expect(submit("locale", "en-GB")).toEqual({ locale: "en-GB" })
	expect(submit("locale", "en-gb")).toEqual({ locale: "en-GB" })
	expect(submit("locale", "not a tag")).toBeNull()
})

test("a timezone nobody is in is refused", () => {
	expect(submit("timezone", "Europe/London")).toEqual({
		timezone: "Europe/London",
	})
	expect(submit("timezone", "Middle/Earth")).toBeNull()
})
