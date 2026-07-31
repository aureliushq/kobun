import matter from "gray-matter"

// gray-matter selects its parsing engine from the file's own `---<lang>` fence and
// always registers a built-in `javascript` engine that runs `eval` on the front matter.
// Since front-matter content is not fully trusted, override that engine with a hard
// failure so a malicious `---js` block can never execute code. This also covers the
// `js` alias (gray-matter routes both `js` and `javascript` to this engine). YAML (the
// default) and JSON (safe `JSON.parse`) remain available.
const HARDENED_OPTIONS = {
	language: "yaml",
	engines: {
		javascript: () => {
			throw new Error("JavaScript front matter is not allowed")
		},
	},
}

export function parseFrontmatter(content: string) {
	return matter(content, HARDENED_OPTIONS)
}

export function stringifyFrontmatter(
	content: string,
	data: Record<string, unknown>,
) {
	return matter.stringify(content, data, HARDENED_OPTIONS)
}
