---
status: accepted
---

# Route loaders await critical data and stream the slow rest behind a skeleton

Every route blocked its first paint on everything its loader touched, so clicking a sidebar link looked like nothing had happened until the slowest thing the loader asked for came back. On the dashboard the slowest thing was not even content: the layout loader awaited `fetch(${appUrl}/manifest.json)` — an untimed request to another origin — to decide whether to show a small blue dot next to the version number, and the dashboard route ran three D1 round-trips to list Drafts before the word "Welcome" could render. Loaders now split their work in two. **Critical data** — what decides which page this is, and whether the writer may see it — stays awaited, and is the only half that may `redirect`. **Slow data** — anything crossing to GitHub or another origin, that gates nothing — is returned as a bare promise and rendered behind `Suspense` + `Await`, with a skeleton of the right shape standing in until it lands.

The line is drawn by what the route *does* with a value, not by what the value costs to fetch, so the same key can fall on either side in different routes. Config is the case that proves it. In the dashboard layout it only populates the sidebar's nav lists, which would make it slow data — but `requirePageContext` redirects to setup when a Project's Config is missing or invalid, so on every route that resolves one it decides whether the page may be seen at all, and a redirect cannot be issued from a deferred promise. Config therefore stays awaited everywhere. That it is *also* now cheap — served from the D1 cache under [ADR 0003](./0003-config-served-from-d1-cache-with-ttl-revalidation.md) — is what makes awaiting it affordable rather than merely necessary.

## The rules that make it safe

Four of these are mechanical, and each one has a failure mode that is silent rather than loud:

- **Every `<Await>` carries an `errorElement`.** `errorElement={null}` is not "no error element" — `null` is falsy, so React Router rethrows past it to the route boundary and takes down the shell the split existed to render. Write `<></>` to mean nothing. `AsyncErrorAlert` is the shared one; it also reports the failure, because an error caught by an `errorElement` never reaches the root boundary that captures the rest.
- **Deferred promises are created after the guards, never before.** A promise started above a `redirect` is a request nobody will ever read.
- **Promises are never derived during render.** `Await` marks the instance it is handed, so a `.then()` in a render body produces a fresh promise each pass and suspends forever. Pass the loader's promise through untouched.
- **Skeleton widths are fixed.** A width that differs between the server render and the client one is a hydration mismatch. This is why the shadcn `SidebarMenuSkeleton` is left unused: it seeds its width from `useState(() => Math.random())`. `packages/ui/components/blocks/skeletons.tsx` cycles a constant list by index instead, and a test asserts two renders agree.

The vocabulary lives in `packages/ui/components/blocks/skeletons.tsx` — `blocks/`, because `base/` is shadcn-managed and a patch there would be clobbered. Each shape is built out of the same container components the real content uses, so its geometry matches by construction rather than by a measured height someone has to keep in step; `CardListSkeleton` renders a real `Card`, down to the `CardDescription` the header's grid keys off. It ships with two shapes. `CardListSkeleton` has this ticket's only caller; `PageHeaderSkeleton` has none yet, and is here because #103 and #104 both open with a heading the dashboard renders from awaited data. That is a deliberate exception to the rule against writing what nothing calls, and a narrow one: `TableRowsSkeleton` is left out on the same reasoning read the other way, because its column widths have to match the Collection table's real `columnDef`s and #103 is where those are known rather than guessed.

A block gets a skeleton when its resolved state is usually non-empty and its position is load-bearing. Otherwise it gets `fallback={null}` — a placeholder for something that usually never arrives, like the update dot, is a flash promising news that isn't coming.

## The bound on "forever"

React Router aborts the turbo-stream encoder after `streamTimeout` and rejects every slot still pending, which surfaces as a rejected promise and therefore as that section's `errorElement`. The framework default is 4950 ms; `app/entry.server.tsx` now exports the value explicitly so the number is greppable from the code that depends on it.

That bounds what the client is *sent*, on a document load and on a client-side navigation alike. It does not bound the server render, which suspends on the original promise rather than on the encoder's copy — so the render is given its own `AbortSignal.timeout(streamTimeout + 1_000)`, a second later, late enough for a section that timed out to render its error state into the document and early enough that nothing waits on a promise that is not coming. Without that signal a hung loader holds the document's stream open indefinitely and `allReady` never resolves for the crawlers that wait on it. Both halves together are what make "never leaves a skeleton animating forever" a property rather than a hope.

## Considered options

- **Await everything (status quo)** — one code path and no partial states, but first paint is coupled to the p99 of every origin the loader touches, including one that only feeds a decoration.
- **Fetch the slow half in a `clientLoader` or an effect** — no server plumbing at all, but the request cannot start until JS has booted and hydration has run, so it is strictly slower than streaming and gives up SSR for the streamed part entirely.
- **React 19's `use()` instead of `Await`** — fewer concepts and no render-prop, but no per-boundary `errorElement`, so every streamed section would need a class `ErrorBoundary` beside it to meet the same guarantee.
- **Defer Config too, by splitting `requirePageContext`'s return** — removes the occasional TTL-expiry round-trip from first paint, but forfeits the redirect on a missing or invalid Config: the page would have to render, then discover it should not have. It also un-picks the seam ADR 0003 had just drawn, for a cost that ADR already made small.
- **A shared `<StreamedSection>` wrapping `Suspense` + `Await`** — would hide the `errorElement` trap behind a default, but three call sites is not yet a pattern, and the wrapper would have to grow a way to opt out of the skeleton on its first use. Revisit when #103 and #104 have landed and the shape is known rather than guessed.

## Consequences

- The Drafts section is streamed even though it is D1-only and fast. It is the ticket's named example and the worked one #103 and #104 follow, but it means an account with no Drafts shows a card skeleton that resolves to nothing. The Config-error block moved above it so that collapse pushes nothing around: awaited content rendered *below* a skeleton is exactly what a skeleton standing for nothing jumps. The new order also reads better — a Config kobun could not parse is more urgent than a Draft.
- The dashboard's cleanup delete now runs on hover, because the Home link prefetches on intent and prefetching runs the real loader. It is a write behind a GET, which is not a shape to copy; it is tolerable only because it deletes Synced Drafts, which are by definition rows the writer has already published and this glossary already says are deleted. A route whose deferred work is not idempotent must not be prefetched.
- Prefetch on intent now covers every sidebar destination, not just the Project switcher. Hovering a Collection therefore warms `collection.tsx`, which still lists that directory on GitHub — so a reader sweeping the mouse down a long sidebar can speculatively fetch several listings. ADR 0003's cache bounds the Config half of that; the listing half is #103's to address.
- Three links are deliberately left without prefetch because warming them would fetch something that is not there: Settings points at a path with no registered route, and the sidebar logo and the header breadcrumb both point at an empty `basePath` that resolves to the current URL. Each is a real bug, filed rather than papered over.
- `VersionInfo` is now only what the build stamps in; what costs a round-trip moved to `ReleaseInfo`. Splitting rather than deferring the whole object keeps `v{currentVersion}` — the widest element in the sidebar footer row — awaited, so that row never reflows.
- `fetchReleaseInfo` no longer requests a manifest when no app URL was configured at build time. The old inline code fetched `undefined/manifest.json` on every dashboard load of a self-hosted instance and swallowed the failure.
