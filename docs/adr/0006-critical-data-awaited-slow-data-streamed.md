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

The vocabulary lives in `packages/ui/components/blocks/skeletons.tsx` — `blocks/`, because `base/` is shadcn-managed and a patch there would be clobbered. Each shape is built out of the same container components the real content uses, so its geometry matches by construction rather than by a measured height someone has to keep in step; `CardListSkeleton` renders a real `Card`, down to the `CardDescription` the header's grid keys off. It shipped with two shapes. `CardListSkeleton` has this ticket's only caller; `PageHeaderSkeleton` has none yet, and is here because #103 and #104 both open with a heading the dashboard renders from awaited data. That is a deliberate exception to the rule against writing what nothing calls, and a narrow one: `TableRowsSkeleton` is left out on the same reasoning read the other way, because its column widths have to match the Collection table's real `columnDef`s and #103 is where those are known rather than guessed. (It landed there — see the amendment below, which is also where `PageHeaderSkeleton` was finally deleted.)

A block gets a skeleton when its resolved state is usually non-empty and its position is load-bearing. Otherwise it gets `fallback={null}` — a placeholder for something that usually never arrives, like the update dot, is a flash promising news that isn't coming.

## The bound on "forever"

React Router aborts the turbo-stream encoder after `streamTimeout` and rejects every slot still pending, which surfaces as a rejected promise and therefore as that section's `errorElement`. The framework default is 4950 ms; `app/entry.server.tsx` now exports the value explicitly so the number is greppable from the code that depends on it.

That bounds what the client is *sent*, on a document load and on a client-side navigation alike. It does not bound the server render, which suspends on the original promise rather than on the encoder's copy — so the render is given its own `AbortSignal.timeout(streamTimeout + 1_000)`, a second later, late enough for a section that timed out to render its error state into the document and early enough that nothing waits on a promise that is not coming. Without that signal a hung loader holds the document's stream open indefinitely and `allReady` never resolves for the crawlers that wait on it. Both halves together are what make "never leaves a skeleton animating forever" a property rather than a hope.

## Amendment: the Collection list, and a fifth rule about keys

Settled while adopting the split on the Collection page (#103), the first route where the streamed
half is addressed by a URL parameter rather than by the session.

`TableRowsSkeleton` now exists, alongside the other two shapes and on the same terms: a `count`
and nothing else, its geometry answering to `collection-table.tsx`'s `columnDef`s — `h-16` cells,
a title bar over the smaller line the created date sits on, and a bar the size of the status
Badge. Its third cell is empty on purpose. The `createdAt` column renders `null` for both header
and cell, but the `<th>` and `<td>` are still walked and still there, so a skeleton row one cell
short would size the columns differently until the real rows arrived. A test pins the skeleton's
cell count to the header's rather than leaving that to a comment.

`PageHeaderSkeleton` is still uncalled, and the reason given for writing it ahead was wrong: this
page's heading is its Collection's label, which comes from the Config and is therefore awaited, so
it is real on the first paint and has nothing to stand in for. #104 either finds a use or deletes
it — the exception was narrow, and it has now failed half the test it was granted on.

**A fifth mechanical rule, and the same kind of silent failure as the other four: a streamed
section whose data is addressed by a URL parameter carries that parameter as a `key` on its
`Suspense`.** Navigating from one Collection to another suspends inside the router's transition,
over a boundary that has already revealed content — and React answers that not by showing the
fallback but by delaying the whole commit. The heading, the controls and the rows all stay on the
Collection the writer just left, which is the original bug moved client-side. A new key at the
boundary's position mounts a boundary with nothing revealed, and that falls back at once. The key
belongs on the `Suspense`, not the `Await`: "already revealed" is a property of the boundary. The
dashboard never met this because its loader keys off the session, so its promise is the same page
every time.

> **Amended by [#142](https://github.com/aureliushq/kobun/issues/142).** The dashboard's promise is
> no longer the same page every time: `?drafts=all` lifts the list's bound, so its streamed half is
> now addressed by the URL after all. Its boundary is still unkeyed, and the sixth rule below is why
> — a key comes from the path, never from the search. What the fifth rule was written to stop does
> not happen here either: expanding the list delays the commit for one cheap D1 round-trip and then
> swaps five cards for every card, where #103's unkeyed boundary held a reader on a Collection they
> had left. Stale-for-a-moment and wrong are not the same fault, and a skeleton flashing over
> content that is already correct is the worse of the two answers.

Two smaller things this route settled. The controls take the *visibly disabled* arm rather than
the *usable immediately* one — the toolbar drives a TanStack instance that needs the rows, and
hoisting four pieces of state into the route to keep keystrokes that are typed into a disabled
box is a cost with nothing on the other side of it. And a GitHub failure on a Collection now
reaches an in-page alert rather than the root boundary, which is what rule one costs: the frame
stays, and `CollectionUnavailable` rebuilds the heading row around the alert so a writer whose
Collection kobun cannot read can still start a new item.

## Amendment: the editor, and the two questions #103 parked

Settled while adopting the split on the Collection Item editor (#104), the first route whose
streamed half the writer types into.

**`PageHeaderSkeleton` is deleted.** It was granted as an exception on the promise that #103 or
#104 would call it. #103's heading turned out to be the Collection's label, which comes from the
Config and is therefore awaited and real on the first paint. #104 has no page heading at all — the
chrome is the *layout's* header, rendered from `parentLabel`, which the layout's own loader awaits
— and the "title area" the ticket names is a Field, which renders for real and disabled rather than
as a bar. It failed the test in both directions of the reasoning, and the general lesson is that
writing a shape ahead of its caller guessed wrong twice out of two.

**`<StreamedSection>` is refused, and the question closes.** The third call site argues against the
wrapper harder than the second did. It needs a fallback and a resolved child that are the same
component under a different prop; a resolved child that then *branches* on a discriminated result;
a different component for the error element; a `key`, which is always the parent's to set; and one
arm — a new item — with no boundary at all. The narrow version that buys only the one thing worth
buying, re-exporting `Await` with a non-nullable `errorElement` so rule one becomes a compile
error, is refused too: `<></>` satisfies such a type anyway, as it must, and a stated rule with
three visible followers is cheaper than a shim nobody remembers exists.

## Amendment: a sixth rule, and what a mount-once prop costs

**A streamed section's key comes from the path, never from the search.** Rule five said to key the
`Suspense` by the URL parameter the streamed data is addressed by; this route says which part of
the URL. The editor puts `?draft=` in the URL the moment the first save mints a Draft, and a key
that noticed would remount the boundary and destroy the document being typed into — the fifth
rule's own fix turned into a worse version of the bug it fixed. `collection-editor.tsx` builds its
key from `collection_slug` and `collection_item_slug` and nothing else.

**`EditorBodySkeleton` is the first shape whose geometry is copied rather than constructed**, and
that is a departure from the rule the vocabulary was built on. The other two are made of the same
`Card` and `TableRow` the real content is, so they cannot drift. This one stands in for a Tiptap
document whose box is declared in CSS in another package — `min-h-[640px]`, `max-w-[42rem]`, the
`h-4`/`gap-2.5` line box of `1rem` at `line-height: 1.625`, and the `pl-12` gutter `RichTextEditor`
renders itself — so the numbers are transcribed from `packages/editor/styles/editor.css` with only
a doc comment tying them back. Nothing fails if that file changes. The alternative, moving the
shape into `packages/editor` beside its source, splits the vocabulary the ADR put in one place for
a drift nobody has yet had; it is the fix if this ever goes wrong, and the reason it is named here
rather than left to be found.

**A prop that is read once at mount cannot be handed a flag and re-seeded later.** `RichTextEditor`
passes `initialContent` to Tiptap's `useEditor` with no dependency array, so a content change after
mount is ignored; the only ways back in are a `key` remount or the imperative `setMarkdown`. So the
pending half of this route renders *no* editor at all rather than a `readOnly` one, and the
boundary's fallback-to-child swap is what seeds the real one. That is the difference between this
route and #103, whose pending half could render its whole table. It is also what makes "autosave
does not fire on the placeholder" free rather than guarded: an editor that never mounts has no
`update` event to debounce and no unmount flush to run.

**One piece of state is hoisted above the boundary**, which #103 declined to do. The line is
whether the writer can reach it while the section is pending: #103's controls were disabled, so
nothing was lost when React remounted around the resolved data; here the properties panel is real
chrome, its toggle lives in the layout header and works from the first paint, and a panel that
reopened itself when the content landed would be a visible fault. One `useState` and the
breakpoint effect that belongs with it are packaged as `usePropertiesPanel`, which the route calls
above the boundary and passes down; the hook and the panel's markup stay together in the view's
file, because they answer to each other rather than to the route.

**Rule one is taken the other way here, deliberately.** The editor's `Await` carries no
`errorElement`, so both ways the streamed half can fail rethrow past it to the route's boundary.
Rule one exists to stop a failed section taking down the shell around it — and on this route the
shell is an editor with nothing to edit, which is not a page a writer can do anything with. A Slug
this Collection no longer holds must still reach the 404 it always did, and a failed read must
still reach the error page it always did; keeping the frame around either would be showing a
writer a title field over an item that is not there.

Making that work is a fact about the wire, not a matter of taste. **A rejected deferred promise
loses everything except its shape.** `sanitizeError` replaces every rejected `Error` with
"Unexpected Server Error" outside development, and the turbo-stream encoder's plugin list
special-cases exactly two things — an `Error` and an `ErrorResponseImpl`. A `Response` thrown
inside the promise is neither, so it falls to the `SingleFetchClassInstance` postPlugin and arrives
as an empty object, because a `Response`'s members live on its prototype. So the loader's
`throw draftRefusalResponse(...)`, which is still right for the awaited new-item path, cannot cross
the stream — and the 404 travels as `UNSAFE_ErrorResponseImpl(404, "Not Found", null)` instead,
which the encoder writes as `["ErrorResponse", …]` and the client rebuilds into something
`isRouteErrorResponse` recognises. A transport failure rejects as itself and reaches the same
boundary as the generic error, which is what it reached before the split. `AwaitErrorBoundary`'s
`if (status === 2 && !errorElement) throw promise._error` is the line all of this turns on.

Two things it costs, stated rather than discovered. The `UNSAFE_` prefix means "not covered by
semver", so a React Router upgrade could move it; `routes/collection-editor.test.tsx` pins the
behaviour rather than the import, and is the first route-level test in the repo for that reason.
And the HTTP status is no longer 404: the document's status line is sent before the deferred half
resolves, so a streamed route physically cannot answer with the status of something it has not
looked up yet. What comes back is the 404 *page*, through the same boundary, on a 200. That is the
one part of "still reaches the error path it does today" that streaming cannot buy back, and no
arrangement of the pieces recovers it short of awaiting the lookup.

**`Await` renders a non-promise synchronously** (`AwaitErrorBoundary.render` short-circuits on
`!(resolve instanceof Promise)`), which is what lets a new item have no placeholder phase at all
rather than a brief one. `Promise.resolve(x)` does *not* take that path — it suspends for a commit
and flushes the fallback into the SSR'd HTML — so "await it and hand `Await` a settled promise" is
not a way to opt a route arm out of its own skeleton. The loader returns a discriminated union on
`mode` instead, and the `Suspense` exists only inside the `item` arm of the JSX, so the property is
structural rather than a behaviour of the framework's internals.

**A hazard worth writing down rather than relying on.** This route must never revalidate its
streamed half while the editor is open: a new promise resuspends the boundary and remounts
`RichTextEditor`, losing whatever the writer had typed. It is safe today because `sendAction` posts
through `fetch` rather than a router submission, the page route's own `action` is only ever reached
at `/api/editor/…`, and `shouldRevalidate` already declines the one navigation that occurs. Three
independent reasons, none of them written down until now.

## Amendment: a value awaited so it can outlive the streamed half

Settled while putting a Collection's Drafts on its own page (#105), the first
route with something worth showing that the slow half's failure must not take
with it.

A Collection's page now lists the writer's Dirty Drafts beside the Collection
Items GitHub holds. Those Drafts are one indexed `SELECT` on `editor_draft`, over
a Project this request has already resolved — and by the rule this ADR states,
they gate nothing and so belong in the streamed half. **They are awaited
anyway**, and the reason is the one the rule is written to allow: the line is
drawn by what the route *does* with a value. What this route does with the
Drafts is show them when GitHub does not answer. A value inside the deferred
promise cannot do that — it rejects with everything else in there — and a second
boundary beside the first buys the same thing for a nested `Suspense`, an error
element of its own, and a table that has to be assembled from two arms landing
in either order. Awaiting puts the Drafts in `loaderData`, where the pending arm
and the error arm both simply have them, and where they paint on the first
navigation rather than whenever their own boundary resolves.

So the cost side of the rule holds: this is I/O in front of the first paint. It
is affordable for the same reason Config is — one round-trip to D1, on the
`(project_id, collection_slug)` index — and the Dirty filter is expressed as SQL
rather than in memory, so a writer's Clean Drafts are never fetched to be
dropped.

**`CollectionUnavailable` is deleted, and `items` becomes `listing`.** The prop
was `CollectionItem[] | null`, and the amendment above called that "one state
rather than a list plus a flag". It is now
`CollectionItem[] | "pending" | "unavailable"` — the third state folds the error
component back into the table, because the error arm and the pending arm now
differ only in which stand-in the body carries and whether an alert sits above
it. Both still render through `CollectionFrame`, so the frame a failed listing
keeps is the same frame by construction rather than by resemblance.

**The invariant that "loading, with rows" cannot be expressed is retired, on
purpose.** It was true when every row came from the same promise. Draft rows are
real while the item rows are still a skeleton, and `TableRowsSkeleton` renders
*under* them rather than instead of them: the Drafts are already in hand, and a
placeholder over content that has arrived is a worse answer than the content.
What survives of the invariant is the part that was load-bearing: neither a
pending listing nor a failed one may reach "No items yet." The toolbar keeps the
narrower rule it always had — disabled while the listing is *pending*, because
filtering a set still arriving answers a question nobody asked. It is enabled on
a failure, deliberately: that listing is never going to land, and a writer with
twenty Drafts and a toolbar frozen forever is worse served than one filtering the
rows that did arrive.

**A Draft whose Source the arrived listing does not hold gets no row**, and #105's
"Drafts participate in the page's sorting and filtering rather than sitting
outside it, or the exception is deliberate and stated" is where this is stated.
The file it tracks has gone from the repository, so `openCollectionItem` answers
its editor with a 404 — and a row that leads to a 404 is worse than no row. It is
not lost: the dashboard lists every Draft regardless of Source, which is where
that one is discarded. Before the listing arrives there is nothing to judge
against, so such a Draft stands alone until its item turns up to absorb it.

One thing this route decides that is presentation rather than architecture, and
is recorded because `CONTEXT.md` warns against exactly it: the Status column
carries **both** vocabularies. A row backed by a Draft shows `UNPUBLISHED` or
`UNPUBLISHED CHANGES` in place of the Publication State its Source records. The
glossary keeps Draft and Publication State apart as *terms*, and they stay apart
— `draftState` in the drafts module answers one, `deriveStatus` answers the
other, and neither knows about the other. What they share is a column, because a
writer looking at a row wants to know who holds the newer copy before they want
to know what the committed file says about itself.

> **Reversed by [ADR-0008](./0008-commit-and-publish-are-separate-acts.md)
> ([#127](https://github.com/aureliushq/kobun/issues/127)).** The reasoning above
> holds only while Publish is the only path to the repository, which makes the two
> questions answers to each other. Save to GitHub makes them independent, and a
> Draft standing in for the Publication State its Source records becomes a lie.
> The column now carries both facts as two badges rather than one, and
> `draftMarker` has replaced `draftState`.

## Considered options

- **Await everything (status quo)** — one code path and no partial states, but first paint is coupled to the p99 of every origin the loader touches, including one that only feeds a decoration.
- **Fetch the slow half in a `clientLoader` or an effect** — no server plumbing at all, but the request cannot start until JS has booted and hydration has run, so it is strictly slower than streaming and gives up SSR for the streamed part entirely.
- **React 19's `use()` instead of `Await`** — fewer concepts and no render-prop, but no per-boundary `errorElement`, so every streamed section would need a class `ErrorBoundary` beside it to meet the same guarantee.
- **Defer Config too, by splitting `requirePageContext`'s return** — removes the occasional TTL-expiry round-trip from first paint, but forfeits the redirect on a missing or invalid Config: the page would have to render, then discover it should not have. It also un-picks the seam ADR 0003 had just drawn, for a cost that ADR already made small.
- **A shared `<StreamedSection>` wrapping `Suspense` + `Await`** — would hide the `errorElement` trap behind a default, but three call sites is not yet a pattern, and the wrapper would have to grow a way to opt out of the skeleton on its first use. Revisit when #103 and #104 have landed and the shape is known rather than guessed. #103 has landed, and it argues against the wrapper rather than for it: that call site needs the fallback and the resolved child to be the *same* component under a different prop, plus a `key`, plus an error element that rebuilds the frame. Three more options is not a shared abstraction. #104 decides.

## Consequences

- The Drafts section is streamed even though it is D1-only and fast. It is the ticket's named example and the worked one #103 and #104 follow, but it means an account with no Drafts shows a card skeleton that resolves to nothing. The Config-error block moved above it so that collapse pushes nothing around: awaited content rendered *below* a skeleton is exactly what a skeleton standing for nothing jumps. The new order also reads better — a Config kobun could not parse is more urgent than a Draft. [#142](https://github.com/aureliushq/kobun/issues/142) closed the "resolves to nothing" half without un-streaming the section: the resolved state is now an empty state naming the first Collection the Config declares, so the skeleton resolves to something at both ends of the range. The same ticket bounded the list at five, which leaves the claim further down this file — that a Draft whose Source the Collection listing does not hold "is not lost: the dashboard lists every Draft regardless of Source" — true only because the bound is liftable: `?drafts=all` lifts it on the same route, and neither that link nor the way back prefetches, because warming them would run the cleanup delete named below.
- The dashboard's cleanup delete now runs on hover, because the Home link prefetches on intent and prefetching runs the real loader. It is a write behind a GET, which is not a shape to copy; it is tolerable only because it deletes Synced Drafts, which are by definition rows the writer has already published and this glossary already says are deleted. A route whose deferred work is not idempotent must not be prefetched.
- Prefetch on intent covers every sidebar destination, not just the Project switcher. Hovering a Collection therefore warms `collection.tsx`, so a reader sweeping the mouse down a long sidebar speculatively runs several Collection loaders — which used to cost one full directory read each, a GraphQL query pulling the text of every file in the directory. It no longer does. ADR 0003's cache bounds the Config half; [#125](https://github.com/aureliushq/kobun/issues/125) closed the listing half, and [ADR-0011](./0011-collection-listing-served-from-d1-cache-with-conditional-revalidation.md) put the parsed listing in D1 behind the same TTL-plus-conditional-revalidation shape — so a sweep inside the window costs nothing at all, and outside it costs one cheap conditional read per Collection, with an unchanged directory answering a rate-limit-free 304. The links keep `prefetch="intent"`: what needed fixing was the caching problem in a streaming problem's clothes, not the prefetch.
- Three links were deliberately left without prefetch because warming them would fetch something that is not there: Settings pointed at a path with no registered route, and the sidebar logo and the header breadcrumb both pointed at an empty `basePath` that resolved to the current URL. Each was a real bug, filed rather than papered over, and all three are now closed. [#116](https://github.com/aureliushq/kobun/issues/116) gave the sidebar logo and the header breadcrumb the active Project's dashboard as their destination, and both now prefetch on intent — so the cleanup delete named above warms from three hover targets rather than one. [#117](https://github.com/aureliushq/kobun/issues/117) closed the other way: the Settings link was removed rather than given a route. Registering one first needed an answer to what a Project's settings even are, and that turned out to be a feature rather than a path — [#132](https://github.com/aureliushq/kobun/issues/132), decided by [ADR-0010](./0010-the-repository-owns-project-behaviour-kobun-owns-the-connection.md). A link is easier to delete than a 404 is to explain, and it has come back: [#138](https://github.com/aureliushq/kobun/issues/138) rebuilt the sidebar footer as the signed-in writer's menu, with two settings destinations behind it — the Project's `/:owner/:name/settings` and the account's `/settings` — both prefetching on intent like every other sidebar link. Nothing in this list is left open.
- `VersionInfo` is now only what the build stamps in; what costs a round-trip moved to `ReleaseInfo`. Splitting rather than deferring the whole object keeps `v{currentVersion}` — the widest element in the sidebar footer row — awaited, so that row never reflows.
- `fetchReleaseInfo` no longer requests a manifest when no app URL was configured at build time. The old inline code fetched `undefined/manifest.json` on every dashboard load of a self-hosted instance and swallowed the failure.
- `mode: "new"` awaits a D1 lookup deliberately. It is I/O, but it is the line this ADR already
  draws — what the route *does* with a value, not what the value costs: that lookup is the only
  thing that can 404 a `?draft=` somebody has since discarded, and a redirect or a throw cannot be
  issued from a deferred promise.
