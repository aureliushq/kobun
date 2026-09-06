import YAML from "yaml"

/**
 * The one YAML implementation behind every Format (ADR-0009). Frontmatter and
 * `.yaml` Sources both read through this, so a scalar cannot come to mean two
 * things depending on which Format carries it — which is what happened while
 * `md`/`mdx` went through gray-matter's built-in js-yaml (YAML 1.1, where a
 * date-shaped scalar becomes a `Date`) and `.yaml` went through this package
 * (YAML 1.2 core, where it stays the text it was written as).
 *
 * It is shaped as a gray-matter engine because that is the fussier of the two
 * consumers; the Content Document's data codecs read the same two members.
 */
export const yamlCodec = {
	parse: (raw: string) => YAML.parse(normalizeLineBreaks(raw)),
	stringify: (data: unknown) => YAML.stringify(data),
}

/**
 * YAML 1.2 has a parser normalize CR and CRLF to LF before anything else reads
 * the stream, and `yaml` leaves that step to its caller. gray-matter cuts the
 * frontmatter block out of a CRLF Source by byte offset, so the parser is handed
 * a dangling lone CR — and what it does with one is worse than refusing it. It
 * refuses only where the CR lands in a structured node (`tags: [one, two]\r`);
 * against a plain scalar it folds the CR into the value, so `published:
 * 2026-07-14` on a CRLF Source reads back as `"2026-07-14\r"` and then fails
 * the `date` Field's own validator. That is the same class of quiet value
 * damage this codec exists to end, so the spec's own step earns its place twice
 * over — in frontmatter and in `.yaml` alike.
 *
 * Fidelity is unaffected: a Source whose Data is unchanged is re-emitted from
 * its own bytes, and the Body is sliced off the raw string rather than off
 * anything the parser returned.
 */
function normalizeLineBreaks(raw: string) {
	return raw.replace(/\r\n?/g, "\n")
}
