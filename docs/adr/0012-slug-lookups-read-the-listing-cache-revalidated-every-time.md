---
status: accepted
---

# Slug lookups read the listing cache, revalidated every time

Save to GitHub went over the Workers free plan's 10ms CPU limit on larger Collections ([#175](https://github.com/aureliushq/kobun/issues/175)). The cause was the drafts module reading the repository live through `SourceStore.list`. `isSlugTaken` pulled the full text of every file in the directory and YAML-parsed each one, on every commit. When an item's frontmatter Slug did not match its filename, `resolveSource` did the same again, on every autosave. Both costs grew with the Collection.

[ADR 0011](./0011-collection-listing-served-from-d1-cache-with-conditional-revalidation.md) kept these reads off the listing cache for one reason: they gate a commit, so they must not be answered from a directory a minute out of date. That reason is about the **window**, not the **row**. So the drafts module now reads the row and skips the window.

- **`resolveCurrent`** is `resolve` with no TTL. It always revalidates. An unchanged directory costs one conditional read and no text. A changed one costs only what changed (below). What it answers is the directory as it is now, which is all the commit gate ever needed.
- **`isSlugTaken`** compares Slugs against the listing's parsed Data. It reads no file and parses no YAML. An existing item that keeps its Slug is not checked at all.
- **`resolveSource`** uses the listing only to find which file answers to a Slug. It then reads that one file live, so the editor still opens current bytes and a current sha.
- `SourceStore.list` has no caller left and is removed from the port.

## A changed directory costs only the files that changed

Before this, a changed directory cost the full Tree query, and every commit through kobun changed one. So a Slug lookup straight after a commit would have paid the whole directory anyway. Now the rebuild keeps every cached item whose name and sha are still in the fresh entry list. It reads and parses only the rest, one `contents` request each. When nothing is cached, or more than `INCREMENTAL_READ_LIMIT` files changed, it reads the whole directory in one query as before. The limit is there because the Workers subrequest budget is shared with the rest of the request.

For this to help after a commit, a write now **expires** the row instead of deleting it. It sets `checked_at` to zero and drops the ETag, which is known to be stale. The items stay, so the next revalidation reads the one file the commit wrote. ADR 0011's "invalidated and never cached are one state" no longer holds. An expired row is a listing that must be revalidated before anyone trusts it.

## Consequences

- A Save to GitHub does CPU work that no longer grows with the Collection, except for the directory listing itself (a JSON parse and one hash over names and shas).
- `resolveCurrent` **fails closed**. When GitHub cannot be reached, `resolve` serves the row it has, but `resolveCurrent` rejects. A Slug checked against a listing GitHub could not confirm is a check that did not happen. A blip that fails one read then fails the commit, not the gate.
- `resolveSource` still refuses a Slug that two listed items claim. The first path, which reads the file named after the Slug, still does not look for a second claimant. Commit's check still refuses that case.
