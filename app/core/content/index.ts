/**
 * The Content Document: the mapping between a Source's raw bytes and its Data
 * plus Body, in both directions, for every Format — and the fidelity guarantee
 * that publishing an unchanged document re-emits it byte-for-byte.
 *
 * `parseDocument`/`serializeDocument` are deliberately not re-exported here.
 * They reach a Source's frontmatter through a node-only parser, so they live in
 * `./document.server` and server code imports them from there; carrying them
 * through this file would drag that parser into every browser bundle that only
 * wanted to compare two Data values — which is exactly what the collection
 * editor's dirty check wants.
 */
export { canonicalMetadata } from "./normalize"
export { type ContentDocument, ContentParseError } from "./types"
