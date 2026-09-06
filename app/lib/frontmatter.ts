import matter from "gray-matter"
import { yamlCodec } from "./yaml"

// gray-matter selects its parsing engine from the file's own `---<lang>` fence and
// always registers a built-in `javascript` engine that runs `eval` on the front matter.
// Since front-matter content is not fully trusted, override that engine with a hard
// failure so a malicious `---js` block can never execute code. This also covers the
// `js` alias (gray-matter routes both `js` and `javascript` to this engine). JSON (safe
// `JSON.parse`) remains available.
//
// The `yaml` engine is overridden for a second, unrelated reason: gray-matter's built-in
// is js-yaml, and a Format must not decide what a scalar means. `yamlCodec` is the one
// implementation every Format reads through — see ADR-0009 and `./yaml`.
const FRONTMATTER_OPTIONS = {
	language: "yaml",
	engines: {
		javascript: () => {
			throw new Error("JavaScript front matter is not allowed")
		},
		yaml: yamlCodec,
	},
}

export function parseFrontmatter(content: string) {
	return matter(content, FRONTMATTER_OPTIONS)
}

export function stringifyFrontmatter(
	content: string,
	data: Record<string, unknown>,
) {
	return matter.stringify(content, data, FRONTMATTER_OPTIONS)
}
