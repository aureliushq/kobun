---
status: accepted
---

# The Collection listing is served from the D1 cache and revalidated on the directory's own identity

Since [#99](https://github.com/aureliushq/kobun/issues/99) every sidebar destination prefetches on
intent, and `prefetch="intent"` runs the real loader. `collection.tsx` listed its Collection's
directory with one GraphQL Tree query that pulls the *full text of every file* in it, so a reader
sweeping the mouse down a sidebar of a dozen Collections asked GitHub to read a dozen directories in
full — for pages they never opened. [ADR 0006](./0006-critical-data-awaited-slow-data-streamed.md)
flagged it and pointed at [#103](https://github.com/aureliushq/kobun/issues/103), which turned out
to be a different problem: streaming changes *when* a listing is shown, not how many listings a
hover triggers, and its only lever was dropping the prefetch that same ticket existed to earn.

So the listing follows the Config: a bounded copy in D1, keyed by Project and directory, served
while it is recent and conditionally revalidated past that
([ADR 0003](./0003-config-served-from-d1-cache-with-ttl-revalidation.md)). The parsed rows — a name,
a path, a sha and the file's Data — live in `collection_listing`, and `createCollectionListingCache`
owns every decision about when to ask GitHub anything at all. Within the window a hover costs
nothing; past it, it costs one cheap conditional read, and only a directory that actually changed
costs the text behind it.

What the cache holds is deliberately the *parsed* listing and not the bytes. The drafts module keeps
reading the repository live through `SourceStore.list`, because two of its reads gate a commit —
`isSlugTaken` decides whether another item already answers to a Slug, and `resolveSource` hands the
editor the bytes and the sha it will write over. Neither may be decided against a directory a minute
out of date, and an editor that opens stale bytes is a worse bug than a slow one. The Collection
page only *names* items, which is the same distinction `lastKnownConfig` already draws against
`createConfigCache`.

## The validator is the directory's own contents, not only its ETag

A GraphQL response carries no ETag, so the conditional half had to be REST:
`listGithubDirectoryEntriesConditional` reads `repos.getContent` on the directory, which answers
with every entry and its blob sha and no bytes at all. An unchanged directory answers `304`, which
costs no rate limit, and that is the answer the whole ticket is about.

But the ETag alone is not trusted to mean "unchanged". GitHub computes a directory's ETag over a
body that carries a per-entry download URL, and on a private repository that URL carries a
short-lived token — so the validator can rotate over a directory that never moved. A blob sha is
content addressed and cannot. `collection_listing.entries_hash` therefore holds every entry's name
and sha, sorted and hashed, and a fresh entry list whose hash matches the stored one short-circuits
without spending the Tree query. That is the job `project.config_sha` already does in ADR 0003, for
the same reason: it is what makes a rotated validator cost nothing rather than cost everything.

The cost of the split is that a directory which *did* change is read twice — once cheaply for its
entries, once for the text. That is the trade the ticket asks for: the expensive call is the one
being rationed, and it is now spent only when there is something new to read.

## As implemented

Four things the decision above left open, settled while building it:

- **A directory that is not there is never written down.** An absent directory is a Collection
  nobody has written into yet, and it answers with an empty listing — but octokit reports a dead
  installation's token exchange with the same `404`, and the two are indistinguishable from here.
  Remembering either would tell a writer their Collection is empty for a whole window. So
  `not-found` is served and not stored, which costs one cheap read per navigation and never a Tree
  query. It is also strictly better than what the route did before, which rendered that same 404 as
  an empty Collection with no window at all and no way back.
- **An unreachable repository throws where the Config cache reports.** ADR 0003 has an `UNKNOWN`
  status to fall back on and this has none, and the difference matters: an empty array is a claim
  that the Collection has no items in it. With a listing cached, a blip serves the stale one and
  writes nothing, so the next request retries rather than the next window. With nothing cached the
  original failure travels out, which rejects the promise the loader handed to `Await` and reaches
  `listing="unavailable"` — the state ADR 0006 built for exactly this. The guard is scoped to the
  port alone, so a Content Document kobun cannot parse still reaches the reader as a failure rather
  than as an empty directory.
- **An empty listing is a listing.** `[]` and "nothing cached" are different answers, and the row
  distinguishes them — a Collection whose directory holds only images caches an empty listing and is
  served from it, rather than paying a read every navigation forever. It also means every caller
  tests `cached !== null` rather than leaning on truthiness.
- **The stored listing is not capped on size.** It was, briefly. A row holds Data and no Body, so a
  listing large enough to trouble D1 would be thousands of items — and a Collection that large
  cannot be read at all, because the query behind `files` pulls every file's text into one response
  and GitHub gives out first. So the cap defended a state nothing can reach, and bought a real one:
  a listing it refused to write is a row that never exists, so the window never opens and every
  hover pays the full read for good — the exact cost this ADR exists to remove.

The row is written in one `INSERT … ON CONFLICT DO UPDATE` against the composite primary key, the
first use of `onConflictDoUpdate` in this repository. One statement rather than a read and a write
is what lets two loaders revalidate the same directory at once without a transaction, which the D1
and better-sqlite3 drivers do not share (the same constraint `ProjectContextDatabase` states).

## Invalidation belongs to the write, not to the publish

`withListingInvalidation` wraps the `SourceStore` and forgets the directory after a write that
landed. It is composed in `collection-editor.tsx`, which is the one place that holds both the store
and a database handle: the drafts module commits through a port and knows nothing about who caches
what (ADR-0001), and the GitHub adapter closes over an installation and nothing else.

Wrapping the write rather than the route's publish branch is the point. Save to GitHub and Publish
are separate acts ([ADR 0008](./0008-commit-and-publish-are-separate-acts.md)) that reach the same
`sourceStore.write`, and a third commit path would reach it too — so the hook sits where the fact
lives instead of at each caller that has to remember it. A refused write changed nothing in the
repository and forgets nothing.

One race is accepted rather than fixed, and it is the sharper edge of prefetching: a Collection page
warmed on hover *before* a publish, whose read finishes after the delete, upserts the pre-publish
listing and holds it for one window. Nothing orders those two, and the writer's own navigation is
the likeliest thing to trigger the hover. It is the same last-write-wins shape ADR 0003 accepts,
bounded the same way — and the window is the reason that bound exists rather than an "invalidate and
forget" one.

## Bounds a future reader will meet

- `repos.getContent` caps a directory at 1000 entries and does not paginate, so a Collection past
  that is fingerprinted over the first 1000 only. This is not a new limit: such a Collection already
  cannot be rendered, because the Tree query would pull the text of all of them into one response.
- A directory that changes and then reverts byte for byte inside one window is not noticed, because
  its fingerprint is what it was. The TTL does not bound this and nothing else does either; it is
  not worth machinery.
- The Data goes through `JSON.stringify` on its way into the row. That is lossless because
  [ADR 0009](./0009-one-yaml-implementation-behind-every-format.md) put YAML 1.2 core behind every
  Format, so a date-shaped scalar stays the text it was written as rather than becoming a `Date`
  that would not survive the trip. YAML's `.inf` and `.nan` still become `null`, which is the one
  place the copy is not the parse.

## Considered options

- **Drop `prefetch="intent"` from the Collection links** — the lever #103 was left with. It costs
  nothing to build and forfeits the warm loader every other sidebar destination has; the acceptance
  criteria rule it out by name.
- **A TTL and no conditional revalidation** — about half the code: no ETag, no fingerprint, no cheap
  read, `CollectionListingSource` collapsing to one method. It bounds the hover sweep, but every
  expiry then costs a full directory read, which is the call the ticket exists to ration.
- **Validate with a second GraphQL query for `entries { name oid }`** — one transport instead of
  two, no 1000-entry cap, and a missing tree comes back cleanly as `object: null` rather than as a
  404 indistinguishable from a broken installation. Rejected only because it spends a rate-limit
  point where a `304` spends none, which is the shape ADR 0003 set. Because the port is a port, this
  is one file's worth of change if the ETag ever proves unreliable in practice.
- **Cache the bytes too, and serve `SourceStore.list` from the same row** — the editor would open
  faster and a publish would cost fewer round trips. Rejected: `isSlugTaken` would gate a commit on
  a stale directory and `resolveSource` would hand the editor stale bytes and a stale sha, and the
  rows would hold every file's text.
- **Invalidate from the route's action after a successful commit** — no decorator and two lines. It
  puts the same knowledge at every caller of `drafts.commit`, and the write already has it.

## Consequences

- A Collection page can show a listing up to a minute old when the repository was changed outside
  kobun. A commit made through kobun is not affected — the write forgets the directory it landed in.
- The Collection route no longer swallows a `404` from the Tree query into an empty listing. That
  catch existed for the installation's auth exchange, and an auth failure now reaches
  `listing="unavailable"` instead of claiming the Collection is empty. It is a correction, not a
  request of [#125](https://github.com/aureliushq/kobun/issues/125).
- `RepositoryAddress` is now shared by two ports rather than describing where a Config is read from.
  It was always the repository's coordinates; only its doc comment claimed otherwise.
- Disconnecting a Project drops its cached listings, by the same cascade that already drops its
  Drafts.
- The adapter and the two octokit functions behind it have no tests, which is how
  `createGithubConfigSource` is treated for the same reason: they are the seam, and testing them
  would need the octokit fake this repository has deliberately never built. What is not covered
  anywhere is the publish-to-listing loop end to end; `e2e/` has no Collection spec to put it in.
