# Ubiquitous Language

Glossary of domain terms. Keep implementation details out — this is vocabulary, not a spec.

## Editing

- **Draft** — an editable working copy of content, kept by Kobun, reconciled against a committed **Source**. A Draft exists from the moment editing begins until its content matches its Source again.
- **Source** — the canonical content: a file committed to the user's GitHub repository. A Draft tracks which Source version it was last reconciled with.
- **Revision** — a counter incremented on every saved change to a Draft. Used to detect two editing sessions racing each other.
- **Published Revision** — the Revision that was last published to the Source. A Draft with no Published Revision has never been published from.
- **Dirty** — a Draft whose Revision is ahead of its Published Revision (or that has never been published). A Dirty Draft holds work the Source doesn't have.
- **Clean** — the opposite of Dirty: the Draft holds nothing the Source lacks.
- **Rebase** — updating a Clean Draft to match a Source that changed underneath it. Only Clean Drafts rebase; a Dirty Draft over a moved Source is a conflict the writer must resolve.
- **Effective Content** — what the editor shows: the Draft's content when Dirty, the Source's content when Clean. The drafts module decides this; callers never compute it.
- **Publish** — committing a Draft's content to its Source. Publishing gates on validation (metadata, slug, required document, duplicate slug) and refuses if the Source moved under a Dirty Draft.
- **Synced** — a Draft whose content matches its Source after a Publish. A Synced Draft is deleted; the Source alone remains.
- **Revision Conflict** — a save or publish carrying a stale expected Revision: another session changed the Draft first. A normal outcome, not an error.
- **Stale Source** — a Draft whose Source changed on GitHub after the Draft went Dirty. Publishing is refused until the writer copies or discards their Draft.

## Access

- **Project** — a user's connection of one GitHub repository to Kobun, through a GitHub App installation. All content access happens through a Project; a repo the user doesn't have a Project for is invisible to them.
- **Config** — a Project's parsed and validated Kobun configuration, declaring its Collections and Singletons. Lives as a file in the repository; a Project whose Config is missing or invalid has no browsable content.

## Content structure

- **Collection** — a directory of content items sharing a schema, addressed by slug.
- **Collection Item** — one Source file within a Collection, addressed by its slug.
- **Singleton** — a single fixed Source file with its own schema; no slug, no directory.
- **Slug** — the identifier of a Collection Item within its Collection; must be unique across the Collection's directory.
- **Field** — one named entry in a Collection or Singleton schema: a label plus either a Field Type or a Role.
- **Field Type** — the kind of value a Field holds, determining how it is defaulted, validated, shown, and edited: `text · url · date · boolean · image · select · multi_select · array · object`. Every Field Type carries an ordinary value.
- **Container** — a Field Type whose value holds other Fields' values: `array` (rows of items) and `object` (named sub-fields). Container behavior is defined in terms of its children's behavior.
- **Scalar** — any non-Container Field Type; its value stands alone.
- **Role** — a structural assignment a schema makes through a Field, rather than a value the Field holds. There are exactly three: the **Slug Role** (this Field is the item's identity, derived from a text Field), the **Document Role** (this Field is where the Body lives), and the **Title Role** (this Field is the display heading for its container — declared on a text Field, or inferred when undeclared). Role rules — exactly one slug per Collection, at most one document, document requires a document Format — are rules about the schema as a whole, not about any value.
- **Format** — how a Source's bytes encode its Content Document: `md`, `mdx`, `json`, or `yaml`.
- **Content Document** — the parsed form of a Source: its Data, plus a Body for document Formats. Every Source is a Content Document in exactly one Format.
- **Data** — the structured fields of a Content Document, always an object (possibly empty). Stored as YAML frontmatter in `md`/`mdx`; as the whole file in `json`/`yaml`.
- **Body** — the prose portion of a Content Document. Only document Formats (`md`/`mdx`) have one; for data-only Formats the Body is null. Giving a data-only document a Body is invalid, not ignorable.
