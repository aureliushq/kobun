# Content Document serialization takes the original raw string and derives fidelity internally

Parsing a Source into `{ data, body }` was copy-pasted across three routes (four formats on read, one on write), and the anti-churn behavior — don't rewrite unchanged frontmatter — leaked out of `collection-items.server.ts` as an exposed `sourcePrefix` string that callers had to thread through the entire draft lifecycle. We centralized both into one module, `app/core/content`, whose write side is `serializeDocument(doc, format, original?: { raw })`: the module re-parses the original raw string internally, compares Data canonically, and either re-emits the original frontmatter block byte-for-byte (Data unchanged) or re-stringifies (Data changed). The fidelity mechanism is an implementation detail; the public contract is a single law — `serializeDocument(parseDocument(raw, f), f, { raw }) === raw` — instead of a hopeful string slice testable only through collections.

## Consequences

- `sourcePrefix` disappears from `ResolvedCollectionItem` and every caller; nothing outside the module knows how fidelity is achieved.
- The module owns `normalizeMetadata`/`canonicalMetadata` (both schema-free). `parseDocument` always returns normalized Data, so YAML `Date` objects never leak — previously the singleton path skipped normalization while the collection path applied it. Schema-aware editor logic stays in `collection-metadata.ts`.
- `ContentDocument` is `{ data: Record<string, unknown>; body: string | null }` — Body is null for data-only Formats (`json`/`yaml`), and serializing a data-only document with a non-null Body throws rather than silently dropping it. `parseDocument` throws a typed `ContentParseError` on malformed input; result unions stay in the drafts layer, where outcomes are normal workflow, not corruption.
- The config file's parsing stays out of scope: it is read-only and bodyless, so it shares no fidelity concern. `Format` is imported from `packages/config`; no `packages/content` package exists because the app is the only consumer.
- Alongside this, `getGithubFileContent` decodes base64 → UTF-8 correctly (the prior `atob` return corrupted non-ASCII text on every single-file read, while the GraphQL directory listing was already correct), and a sibling `getGithubFileBytes` serves binary consumers like `api.repo-asset.ts`.

## Considered options

- **Keep `sourcePrefix` as a public primitive** — avoids re-parsing on write, but the fidelity mechanism stays part of the contract and every caller must persist an opaque string across the draft lifecycle.
- **Full lossless model (YAML CST)** — would preserve untouched keys' order/whitespace even when Data changes; far heavier machinery than any current need justifies. Revisit only if partial-metadata churn becomes a real complaint.
- **Lenient parse fallback (`{ data: {}, body: raw }`)** — rejected: a writer editing a misparsed file and publishing would silently destroy the original; an error page beats data loss.
