---
status: accepted
---

# A Subcollection's items nest under their Parent Item's filename

A Collection can declare **Subcollections** (`subcollections` on a Collection in the Config, `packages/config/schema.ts`): every project in `projects` owns its own `updates`. Each **Parent Item** owns its own set of the Subcollection's items, so the items need a home that says which Parent they belong to. We store them in a directory beside the Parent Item, named after the Parent Item's **filename** without its extension: `projects/acme.md` owns `projects/acme/updates/<slug>.md`.

The anchor is the filename rather than the Slug because Kobun never renames files. A Collection Item's Slug names its file when the item is created, but editing the Slug later changes the Data and leaves the file where it is. Anchoring on the Slug would make that edit move the Parent's whole directory of items, or leave them pointing at a name that no longer exists. Anchoring on the filename means a Slug edit moves nothing.

A Subcollection is declared with the same shape as a Collection and is validated as one: Role rules apply, and its Features expand into Managed Fields ([ADR-0005](./0005-features-expand-into-managed-fields.md)). It inherits nothing from its Collection. It goes one level deep, and only Collections have Subcollections; a Singleton has no items to be a Parent. Each Subcollection is validated on its own, so a bad one is reported as a Config error scoped to it and its Parent, siblings and the rest of the Config still load.

## Considered Options

- **A flat Collection plus a reference Field** — `updates` as an ordinary Collection whose items carry a Field naming their project. Rejected: nothing in the repository's layout says which project an update belongs to, every listing has to read every item to filter by the Field, and a deleted or renamed project leaves its updates pointing at nothing.
- **Nesting under the Parent Item's Slug** — `projects/<slug>/updates/`. Rejected: a Slug is editable, so editing it either moves a directory of files or orphans them.
- **Nesting under the Parent Item's filename** — accepted, for the reasons above.

## Consequences

- The Parent's directory and its file sit side by side (`acme.md` and `acme/`), which a site's content loader must not mistake for an item.
- A Parent Item's filename is now load-bearing. Anything that ever renames a file would have to move its Subcollection directories with it.
- Subcollections nest exactly one level, so a path is always `<collection>/<parent>/<subcollection>/<item>`.

## References

- Ticket: [#180](https://github.com/aureliushq/kobun/issues/180)
- Glossary terms: **Subcollection**, **Parent Item** — added to `CONTEXT.md` by #180, alongside the amended **Collection** and **Config**
- [ADR-0005](./0005-features-expand-into-managed-fields.md) — Features expand into Managed Fields, for Subcollections too
