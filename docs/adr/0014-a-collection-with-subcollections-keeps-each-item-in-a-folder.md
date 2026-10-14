---
status: accepted
---

# A Collection with Subcollections keeps each item in a folder

[ADR-0012](./0012-subcollection-items-nest-under-the-parent-items-filename.md) stored a Parent Item as a file, with its Subcollections in a directory beside it: `projects/acme.md` and `projects/acme/updates/`. A real site laid out the other way could not be managed at all: `projects/acme/index.md` with `projects/acme/updates/`. Kobun listed only the Collection's top-level md/mdx files, so it saw no items. The file-plus-directory pair is also the layout a site's content loader has to learn to ignore, and two names per item is one more than a writer expects.

So a Collection that declares Subcollections keeps each item in a folder of its own: `projects/acme/index.<format>`. Its Subcollections' items live in the same folder: `projects/acme/updates/<slug>.md`. A Collection without Subcollections is unchanged: `<slug>.<format>`.

- **The anchor is the folder's name.** ADR-0012 anchored Subcollections on the Parent's filename stem, because Kobun never renames files. A folder item's stem is its folder's name, and Kobun never renames folders either, so the anchor, the URLs and the Draft ownership columns are unchanged.
- **The layout follows from the Config.** No option declares it. A Collection with Subcollections has folder items; one without has file items. A Collection cannot hold both.
- **A listed folder item is named after its folder** and carries its index file's path. A folder with no `index.md` or `index.mdx` is not an item.
- **A new item's Slug names its folder**, the way it named its file.

## Consequences

- A folder item carries its folder's tree sha. A write anywhere in the folder changes that sha, including a Subcollection item's commit. A changed folder Collection is read again in full, with one query. Reading only the changed folders is left until such Collections grow large.
- A full read asks GitHub's Tree query for one more level, so it returns every text file directly inside each item's folder, not only its index.
- A repository laid out per ADR-0012 (`acme.md` beside `acme/`) no longer lists its Parent Items. Reading both layouts was considered and deferred until someone needs it.

## References

- Supersedes the layout in [ADR-0012](./0012-subcollection-items-nest-under-the-parent-items-filename.md). Its choice of anchor stands.
- [ADR-0011](./0011-collection-listing-served-from-d1-cache-with-conditional-revalidation.md), [ADR-0012](./0012-slug-lookups-read-the-listing-cache-revalidated-every-time.md): the listing cache this extends.
