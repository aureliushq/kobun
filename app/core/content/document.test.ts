import { describe, expect, it } from "vitest"
import type { Format } from "@/config/types"
import { parseDocument, serializeDocument } from "./document.server"
import { type ContentDocument, ContentParseError } from "./types"

/**
 * Quirky Sources: things a writer could plausibly have committed by hand. The
 * round-trip law has to hold for all of them, not just for the tidy output our
 * own serializer produces.
 *
 * The document quirks run against both document Formats rather than being
 * hand-listed per Format, so "all four Formats × quirky inputs" is a property
 * of the table instead of something that quietly rots as cases are added.
 */
const DOCUMENT_QUIRKS = [
	{
		name: "frontmatter in a hand-written key order",
		raw: "---\nzebra: last\nalpha: first\n---\nBody\n",
	},
	{
		name: "a comment inside the frontmatter",
		raw: "---\n# keep this comment\ntitle: Hello\n---\nBody\n",
	},
	{
		name: "CRLF line endings",
		raw: "---\r\ntitle: Hello\r\ntags: [one, two]\r\n---\r\nBody line\r\n",
	},
	{ name: "empty frontmatter", raw: "---\n---\nBody\n" },
	{ name: "no frontmatter at all", raw: "Just a body, no frontmatter.\n" },
	{ name: "frontmatter and no Body", raw: "---\ntitle: Hello\n---\n" },
	{
		name: "a horizontal rule in the Body",
		raw: "---\ntitle: Hello\n---\nBefore\n\n---\n\nAfter\n",
	},
	{
		name: "a JSX element in the Body",
		raw: "---\ntitle: Hello\n---\n<Note>Hi</Note>\n",
	},
	{
		name: "non-ASCII Data and Body",
		raw: "---\ntitle: café\n---\n日本語 and 🎉\n",
	},
	{
		name: "a datetime carrying a time component",
		raw: "---\npublishedAt: 2026-07-14T09:30:00.000Z\n---\nBody\n",
	},
	{
		name: "a datetime with no zone",
		raw: "---\npublishedAt: 2026-07-14T09:30:00\n---\nBody\n",
	},
	{
		name: "a datetime at midnight UTC",
		raw: "---\npublishedAt: 2026-07-14T00:00:00.000Z\n---\nBody\n",
	},
	{
		name: "a datetime carrying an offset rather than Z",
		raw: "---\npublishedAt: 2026-07-14T09:30:00+05:30\n---\nBody\n",
	},
]

const DATA_QUIRKS: Array<{ format: Format; name: string; raw: string }> = [
	{
		format: "json",
		name: "a hand-written key order and loose whitespace",
		raw: '{"zebra":"last",   "alpha": "first"}',
	},
	{ format: "json", name: "an empty object", raw: "{}\n" },
	{
		format: "json",
		name: "CRLF line endings",
		raw: '{\r\n\t"title": "Hello"\r\n}\r\n',
	},
	{
		format: "json",
		name: "non-ASCII values",
		raw: '{\n\t"title": "café 日本語 🎉"\n}\n',
	},
	{
		format: "yaml",
		name: "a hand-written key order",
		raw: "zebra: last\nalpha: first\n",
	},
	{
		format: "yaml",
		name: "leading and inline comments",
		raw: "# leading comment\ntitle: Hello # trailing\ntags:\n  - one\n",
	},
	{
		format: "yaml",
		name: "CRLF line endings",
		raw: "title: Hello\r\ntags:\r\n  - one\r\n",
	},
	{ format: "yaml", name: "an empty file", raw: "" },
	{ format: "yaml", name: "non-ASCII values", raw: "title: café 日本語 🎉\n" },
	{
		format: "json",
		name: "a datetime carrying a time component",
		raw: '{\n\t"publishedAt": "2026-07-14T09:30:00.000Z"\n}\n',
	},
	{
		format: "yaml",
		name: "a datetime carrying a time component",
		raw: "publishedAt: 2026-07-14T09:30:00.000Z\n",
	},
]

const QUIRKY_SOURCES: Array<{ format: Format; name: string; raw: string }> = [
	...(["md", "mdx"] as const).flatMap((format) =>
		DOCUMENT_QUIRKS.map((quirk) => ({ ...quirk, format })),
	),
	...DATA_QUIRKS,
]

describe("the round-trip law", () => {
	for (const { format, name, raw } of QUIRKY_SOURCES) {
		it(`re-emits ${format} with ${name} byte-for-byte`, () => {
			expect(
				serializeDocument(parseDocument(raw, format), format, { raw }),
			).toBe(raw)
		})
	}

	it("never exposes the fidelity mechanism on a parsed document", () => {
		const document = parseDocument("---\ntitle: Hello\n---\nBody\n", "md")
		expect(Object.keys(document).sort()).toEqual(["body", "data"])
	})
})

describe("a changed Body", () => {
	it("leaves the frontmatter block byte-identical and appends the new Body", () => {
		const raw =
			'---\r\n# keep this comment\r\ntitle: "Hello"\r\ntags: [one, two]\r\n---\r\nOriginal body\r\n'
		const document = parseDocument(raw, "md")

		expect(
			serializeDocument({ ...document, body: "Updated body\n" }, "md", { raw }),
		).toBe(
			'---\r\n# keep this comment\r\ntitle: "Hello"\r\ntags: [one, two]\r\n---\r\nUpdated body\n',
		)
	})

	it("does not churn frontmatter when the Data is only reordered", () => {
		const raw = "---\ntitle: Old\nunknown: keep\n---\nBody\n"
		const document = parseDocument(raw, "md")

		expect(
			serializeDocument(
				{ data: { unknown: "keep", title: "Old" }, body: "Body\n" },
				"md",
				{ raw },
			),
		).toBe(raw)
		expect(document.data).toEqual({ title: "Old", unknown: "keep" })
	})
})

describe("changed Data", () => {
	it("re-stringifies markdown through gray-matter", () => {
		const raw = "---\ntitle: Old\nunknown: keep\n---\nBody\n"
		const document = parseDocument(raw, "md")

		expect(
			serializeDocument(
				{ ...document, data: { title: "New", unknown: "keep" } },
				"md",
				{ raw },
			),
		).toBe("---\ntitle: New\nunknown: keep\n---\nBody\n")
	})

	it("re-stringifies mdx through gray-matter", () => {
		const raw = "---\ntitle: Old\n---\n<Note>Hi</Note>\n"
		const document = parseDocument(raw, "mdx")

		expect(
			serializeDocument({ ...document, data: { title: "New" } }, "mdx", {
				raw,
			}),
		).toBe("---\ntitle: New\n---\n<Note>Hi</Note>\n")
	})

	it("re-stringifies json tab-indented with a trailing newline", () => {
		const raw = '{"title":"Old"}'

		expect(
			serializeDocument(
				{ data: { title: "New", tags: ["one", "two"] }, body: null },
				"json",
				{ raw },
			),
		).toBe('{\n\t"title": "New",\n\t"tags": [\n\t\t"one",\n\t\t"two"\n\t]\n}\n')
	})

	it("re-stringifies yaml with the library defaults and a trailing newline", () => {
		const raw = "title: Old\n"

		expect(
			serializeDocument(
				{ data: { title: "New", tags: ["one", "two"] }, body: null },
				"yaml",
				{ raw },
			),
		).toBe("title: New\ntags:\n  - one\n  - two\n")
	})

	it("creates a frontmatter block for markdown that had none", () => {
		const raw = "Just a body.\n"
		const document = parseDocument(raw, "md")

		expect(document.data).toEqual({})
		expect(
			serializeDocument({ ...document, data: { title: "Added" } }, "md", {
				raw,
			}),
		).toBe("---\ntitle: Added\n---\nJust a body.\n")
	})
})

describe("frontmatter dates", () => {
	it("parses an unquoted date as a yyyy-mm-dd string", () => {
		const document = parseDocument(
			"---\npublished: 2026-07-14\n---\nBody\n",
			"md",
		)

		expect(document.data.published).toBe("2026-07-14")
	})

	it("round-trips a dated document byte-identically when it is unchanged", () => {
		const raw = "---\npublished: 2026-07-14\n---\nBody\n"

		expect(serializeDocument(parseDocument(raw, "md"), "md", { raw })).toBe(raw)
	})

	it("parses an unquoted datetime with its time component intact", () => {
		const document = parseDocument(
			"---\npublishedAt: 2026-07-14T09:30:00.000Z\n---\nBody\n",
			"md",
		)

		expect(document.data.publishedAt).toBe("2026-07-14T09:30:00.000Z")
	})

	it("appends a new Body without rewriting the date", () => {
		const raw = "---\npublished: 2026-07-14\n---\nBody\n"
		const document = parseDocument(raw, "md")

		expect(
			serializeDocument({ ...document, body: "Updated\n" }, "md", { raw }),
		).toBe("---\npublished: 2026-07-14\n---\nUpdated\n")
	})

	// A zone is what makes a datetime name one moment rather than a different
	// one per timezone, so a value that arrives without a zone has to stay
	// without one and be refused. Inventing UTC here would answer the question
	// "when did this happen?" on the writer's behalf.
	it("leaves a zoneless datetime zoneless rather than deciding it meant UTC", () => {
		const document = parseDocument(
			"---\npublishedAt: 2026-07-14T09:30:00\n---\nBody\n",
			"md",
		)

		expect(document.data.publishedAt).toBe("2026-07-14T09:30:00")
	})

	// The mirror case: an instant that lands exactly on the UTC day boundary is
	// still an instant, and truncating it to a day both destroys the time and
	// makes the value fail the validation it previously passed.
	it("keeps a midnight-UTC datetime whole rather than collapsing it to a day", () => {
		const document = parseDocument(
			"---\npublishedAt: 2026-07-14T00:00:00.000Z\n---\nBody\n",
			"md",
		)

		expect(document.data.publishedAt).toBe("2026-07-14T00:00:00.000Z")
	})

	// The round-trip law cannot see this one: both sides of its comparison parse
	// the same way, so a carriage return folded into a value survives it
	// unnoticed. gray-matter cuts the frontmatter block by byte offset and hands
	// the parser a dangling CR, which lands in the value of whatever scalar it
	// ends — and a date carrying one fails the `date` Field's validator.
	it("does not fold a CRLF Source's line ending into the value", () => {
		const document = parseDocument(
			"---\r\npublished: 2026-07-14\r\n---\r\nBody\r\n",
			"md",
		)

		expect(document.data.published).toBe("2026-07-14")
	})

	// js-yaml had to quote a date-shaped string on the way out, because unquoted
	// it would have read back as a `Date` — so the writer's first Data edit
	// rewrote a line they had not touched. Writing and reading the same spelling
	// means an edit changes only what was edited.
	it("re-stringifies a date without quoting it, so a second pass is a no-op", () => {
		const raw = "---\npublished: 2026-07-14\n---\nBody\n"
		const rewritten = serializeDocument(
			{ data: { published: "2026-07-14", title: "Added" }, body: "Body\n" },
			"md",
			{ raw },
		)

		expect(rewritten).toBe(
			"---\npublished: 2026-07-14\ntitle: Added\n---\nBody\n",
		)
		expect(parseDocument(rewritten, "md").data.published).toBe("2026-07-14")
	})
})

/**
 * A Format says how a Source's bytes are encoded, not what they mean. So the
 * same authored scalar has to read back as the same value whichever Format
 * carries it — the law both of the date bugs broke, by parsing md/mdx
 * frontmatter with a different YAML implementation than `.yaml` Sources.
 *
 * json is the reference: it has only strings, so it cannot be the one that
 * disagrees.
 */
describe("a scalar means the same thing in every Format", () => {
	const SCALARS = [
		{ name: "a date", scalar: "2026-07-14" },
		{ name: "a datetime with no zone", scalar: "2026-07-14T09:30:00" },
		{ name: "a datetime at midnight UTC", scalar: "2026-07-14T00:00:00.000Z" },
		{ name: "a datetime with an offset", scalar: "2026-07-14T09:30:00+05:30" },
		{ name: "a clock time", scalar: "09:30:00" },
	]

	for (const { name, scalar } of SCALARS) {
		it(`reads ${name} as the text the writer authored`, () => {
			const sources: Array<[Format, string]> = [
				["md", `---\npublishedAt: ${scalar}\n---\nBody\n`],
				["mdx", `---\npublishedAt: ${scalar}\n---\nBody\n`],
				["yaml", `publishedAt: ${scalar}\n`],
				["json", `{"publishedAt": "${scalar}"}\n`],
			]

			for (const [format, raw] of sources) {
				expect(parseDocument(raw, format).data.publishedAt).toBe(scalar)
			}
		})
	}
})

/**
 * The other half of reading frontmatter as YAML 1.2 core: the 1.1 spellings
 * js-yaml used to special-case now behave in `md`/`mdx` exactly as they always
 * have in `.yaml` Sources. Pinned because it is the user-visible part of the
 * change, and because "both Formats agree" is the point even where the value
 * they agree on is not the one YAML 1.1 would have given (ADR-0009).
 */
describe("the YAML 1.1 spellings", () => {
	const SPELLINGS = [
		{ name: "an unquoted yes", scalar: "yes", value: "yes" },
		{ name: "an unquoted off", scalar: "off", value: "off" },
		{ name: "a leading-zero number", scalar: "0644", value: 644 },
		{ name: "an unquoted true", scalar: "true", value: true },
	]

	for (const { name, scalar, value } of SPELLINGS) {
		it(`reads ${name} the same way in md as in yaml`, () => {
			expect(
				parseDocument(`---\nflag: ${scalar}\n---\nBody\n`, "md").data.flag,
			).toBe(value)
			expect(parseDocument(`flag: ${scalar}\n`, "yaml").data.flag).toBe(value)
		})
	}
})

describe("a data-only Format given a Body", () => {
	for (const format of ["json", "yaml"] as const) {
		it(`refuses to serialize ${format} rather than dropping the prose`, () => {
			expect(() =>
				serializeDocument({ data: { title: "Hello" }, body: "prose" }, format),
			).toThrow(/Body/)
		})
	}

	it("parses a data-only Format to a null Body", () => {
		expect(parseDocument('{"title":"Hello"}', "json").body).toBeNull()
		expect(parseDocument("title: Hello\n", "yaml").body).toBeNull()
	})

	it("reads an empty yaml document as empty Data, not as a missing file", () => {
		expect(parseDocument("", "yaml")).toEqual({ data: {}, body: null })
		expect(parseDocument("null", "yaml")).toEqual({ data: {}, body: null })
	})
})

describe("malformed input", () => {
	const MALFORMED: Array<{ format: Format; name: string; raw: string }> = [
		{
			format: "md",
			name: "an unterminated flow collection in the frontmatter",
			raw: "---\ntitle: [1,\n---\nBody\n",
		},
		{
			format: "mdx",
			name: "an unterminated flow collection in the frontmatter",
			raw: "---\ntitle: [1,\n---\nBody\n",
		},
		{ format: "json", name: "a truncated object", raw: "{oops" },
		{
			format: "yaml",
			name: "a tab used for indentation",
			raw: "a: 1\n\tb: 2\n",
		},
		{ format: "json", name: "an array at the root", raw: "[1, 2, 3]" },
		{ format: "json", name: "a bare string at the root", raw: '"hello"' },
		{ format: "json", name: "a null at the root", raw: "null" },
		{ format: "yaml", name: "a sequence at the root", raw: "- one\n- two\n" },
	]

	for (const { format, name, raw } of MALFORMED) {
		it(`rejects ${format} with ${name}`, () => {
			let thrown: unknown
			try {
				parseDocument(raw, format)
			} catch (error) {
				thrown = error
			}

			expect(thrown).toBeInstanceOf(ContentParseError)
			expect((thrown as ContentParseError).format).toBe(format)
			expect((thrown as ContentParseError).cause).toBeDefined()
		})
	}
})

describe("serializing without an original", () => {
	it("stringifies a fresh document in each Format", () => {
		expect(
			serializeDocument({ data: { title: "New" }, body: "Body\n" }, "md"),
		).toBe("---\ntitle: New\n---\nBody\n")
		expect(
			serializeDocument({ data: { title: "New" }, body: null }, "json"),
		).toBe('{\n\t"title": "New"\n}\n')
		expect(
			serializeDocument({ data: { title: "New" }, body: null }, "yaml"),
		).toBe("title: New\n")
	})

	it("emits no frontmatter block for markdown with empty Data", () => {
		const document: ContentDocument = { data: {}, body: "Body only.\n" }

		expect(serializeDocument(document, "md")).toBe("Body only.\n")
	})

	// The loud failure belongs to the data-only Formats, where a Body would be
	// prose thrown away. A document Format with a null Body has no prose to lose,
	// so it writes the Data and an empty Body rather than refusing.
	it("treats a null Body on a document Format as no prose", () => {
		expect(
			serializeDocument({ data: { title: "Hello" }, body: null }, "md"),
		).toBe("---\ntitle: Hello\n---\n\n")
	})
})
