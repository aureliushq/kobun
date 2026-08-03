# The drafts module owns the publish commit, behind a SourceStore port

The draft ↔ published state machine (revision guards, rebase, publish → sync → delete) was inlined in `collection-editor.tsx`'s loader/action and untestable. We extracted it into a `drafts` module (`app/core/editor/drafts/`, `createDrafts` factory) and decided the module **executes the GitHub commit itself**, through an injected narrow `SourceStore` port (`list`, `write(path, content, expectedSha)`), rather than returning a "please commit this" intent for the route to execute. Publish is not commit-then-done — it's commit → guarded sync UPDATE → fallback sync → delete-when-synced, with GitHub's stale-sha 409 translated into a draft-level conflict; an intent-returning design would split that chain back across the route seam, recreating the disease. The port also absorbs all GitHub identity (`env`, `installationId`, `owner`, `name`) into its adapter closure, so the module's world is just a database and a place source files live.

## Consequences

- Tests fake `SourceStore` with a Map and run the real `editorDraft` schema on in-memory SQLite — the `UPDATE ... WHERE revision = ?` guard semantics are the subject under test, so the database is never faked.
- The module reports outcomes as typed result unions (`revision-conflict`, `stale-source`, `duplicate-slug`, `validation`, `not-found`), never thrown `Response`s; routes own a single code → HTTP status map. Conflicts are normal operation (a second tab racing autosave), not exceptions.
- Non-HTTP callers (singleton editor, CLI, background jobs) can drive the full lifecycle without a route.

## Considered options

- **Module returns a commit intent; route executes it** — keeps the module free of I/O, but publish becomes a two-phase dance and the post-commit sync logic leaks back into every caller.
- **Module imports `createOrUpdateGithubTextFile` directly** — simplest, but the only test seam is module mocking, and GitHub identity spreads through the module's context.
