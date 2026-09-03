---
status: accepted
---

# Committing and publishing are separate acts

Publish is the only path from Kobun to the repository, so every committed file is published by
construction. That makes **Publication State** a constant: `status: draft` is unreachable in
committed content, and the `status` Managed Field [ADR-0005](./0005-features-expand-into-managed-fields.md)
contributes has nothing to say. A writer with a half-written post has nowhere to put it but D1.

We are splitting the one act in two. **Commit** — writing a Draft's content to its Source — is
what both paths do. **Publish** is a Commit that *also* declares the item published; it is the
only thing that writes `status`, and it always writes `published`. **Save to GitHub** is a
Commit and nothing else: it never touches `status`, so what it commits is whatever the writer's
fields already said.

That is the whole design, and every other answer here falls out of it.

## The chrome

```
[ Save ▾ ]                          [ Publish ]
  ├ Save            → D1              only when the `publish` Feature is on
  └ Save to GitHub  → repository
```

Save and Save to GitHub are one split control on GitHub's *Create pull request / Create draft
pull request* pattern — primary button plus a dropdown that switches which action it is, the
choice sticking until the writer changes it. They differ in **target and nothing else**. That
is why they belong to one control: a writer choosing between them is choosing where the bytes
go, not what the bytes mean.

Publish is a separate button because it means something else entirely, and it is absent when
the Collection has no `publish` Feature — there is no Publication State to declare, so there is
nothing for it to do that Save to GitHub does not already do.

## Flipping a committed `draft` past the matches-Source short-circuit

A publish whose content already matches its Source short-circuits into no commit, and that
comparison includes the Data. So the sequence this feature exists to enable — Save to GitHub,
reopen, Publish, change nothing else — would find the content unchanged and never flip `status`.
A Publication State transition has to itself count as a change.

The fix is *where* the stamp lands, not *whether* it lands. `status` becomes a **clock-free
intent stamp applied before the comparison**; the timestamps stay observational and land after
the comparison has already decided there is a change, which is #87's ordering rule untouched.

```
intent    = action === "publish" ? withPublishedStatus(fields) : fields
unchanged = matchesSource({ ...input, fields: intent })
stamped   = unchanged ? input : stampTimestamps(intent, now, source, action)
```

| Source `status` | action | intent | outcome |
| --- | --- | --- | --- |
| `draft` | Publish | `published` | differs → **commit** |
| `published` | Publish | `published` | equal → no commit |
| absent, Feature on | Publish | `published` | differs → **commit** |
| `draft` | Save to GitHub | untouched | equal → no commit |
| anything | Save to GitHub | untouched | the body and the writer's fields decide |

**This cannot reintroduce the churn bug #87 exists to prevent.** That bug is a clock in the
comparison: a stamp applied after the Draft is persisted leaves a surviving Draft holding an
`updatedAt` its Source lacks, the comparison never matches again, and every later publish
commits a fresh timestamp forever. No clock enters this comparison. The intent stamp is a pure
function of the action and the schema, it is idempotent, and it reaches a fixed point in one
step — the second Publish of an item already `published` compares equal and commits nothing.
The `published-unsynced` case survives too: a Draft the guarded sync could not claim survives
holding exactly the stamped fields that were committed, so its next comparison matches.

## What each action stamps

| | Save to GitHub | Publish |
| --- | --- | --- |
| `createdAt` | keep, else now | keep, else now |
| `updatedAt` | now, unless the writer set it | now, unless the writer set it |
| `publishedAt` | **untouched** | keep, else now |
| `status` | **untouched** | **always `published`** |

`updatedAt` advances on a Save to GitHub because it is a fact about when the bytes changed and
Save to GitHub changes the bytes — ADR-0005's own reasoning, applied to a path it did not have.
`publishedAt` is a fact about publication, so only the action that publishes may write it.

## The amendment this forces on #87

#87 stamped `status: published` **only for an Item Kobun is creating**; where the Source already
existed, `status` passed through untouched — never added when absent, never overwritten when
present. The reason was that Publication State is the writer's intent about content Kobun may
not have authored, and guessing it would let an ordinary edit silently unpublish a live post.

That rule **moves from being a rule about Sources to a rule about actions**:

> `status` is written by Publish and by nothing else. Publish always writes `published`.

The fear the old rule guarded against is now closed by construction rather than by a test on
the Source: ordinary editing goes through Save to GitHub, which never touches `status`, so a
typo fix cannot unpublish anything no matter what the Source carries. Nothing needs to record
which Sources Kobun authored, and the rule does not narrow to "Sources with no `status` key" —
the question the old rule was trying to answer by inspecting the file is answered by the button
the writer pressed.

One behaviour changes: Publish now adds `status: published` to a pre-existing Source that lacks
the key, which #87 forbade. That is acceptable because the button exists at all only where the
config author turned the `publish` Feature on, which is itself the statement that `status` is
Kobun's to manage in that Collection. `deriveStatus` reading an absent `status` as `PUBLISHED`
(`app/core/editor/collection-list.ts`) is unaffected and stays.

## Gates

| | Save to GitHub | Publish |
| --- | --- | --- |
| valid Slug — it is the filename | refuse | refuse |
| duplicate Slug | refuse | refuse |
| moved Source | refuse | refuse |
| metadata validation | allow | refuse |
| required document empty | allow | refuse |

Identically whether the `publish` Feature is on or off. The three structural gates are about
where the bytes land: an invalid Slug has no filename, a duplicate Slug commits on top of a
different item and destroys it, a moved Source drops whatever replaced it. Those are Kobun's to
refuse because Kobun would be the one doing the damage. "Required" is a claim about a *finished*
item, and Publish is the action that makes that claim — holding it against a backup makes the
backup useless for the half-written post it exists for.

A Collection with no `publish` Feature therefore has no gated path to the repository, where
today it has one. That is deliberate. Kobun is a CMS; enforcing that a repository only ever
holds complete content is the site's build's job, not the editor's.

Every refusal is reported the way Publish's already are — typed, never thrown
([ADR-0001](./0001-drafts-module-owns-publish-via-sourcestore-port.md)) — and a refused Save to
GitHub keeps what the writer typed, because the content is persisted as the Draft before any
gate runs.

## The Draft afterwards

Save to GitHub runs ADR-0001's chain unchanged: commit → guarded sync → delete-when-Synced. A
Draft exists to hold what the Source lacks; after the commit the Source holds it, which is the
definition of **Synced**. Reopening reads Publication State from the Source, where the Status
Field — editable since #86 — shows it.

Nothing is kept as a provenance record, because nothing asks the question a provenance record
would answer.

## Considered options

- **Save to GitHub writes `status: draft` itself** — the framing #90 and #91 were filed with.
  Rejected: it makes a *save* an opinion about publication. Applied to a live post it silently
  unpublishes something the writer only meant to back up; withheld from a live post it makes
  the same button mean two different things depending on state. Letting the action decide
  `status` only when the action is *Publish* leaves Save to GitHub honest — a save is a save,
  and the only thing the writer chose was where it goes.
- **Compare on the writer's fields only** — drop every Managed Field from the matches-Source
  comparison. Rejected: a writer who backdates a `publishedAt` or corrects an `updatedAt` and
  changes nothing else would read as unchanged and their edit would never be committed, which
  is exactly the edit #86 made possible. It also still needs a separate rule for when a state
  transition alone forces a commit, so it adds a special case rather than removing one.
- **Drop the short-circuit on Publish** — always commit. This *is* the churn bug, made
  deliberate: every Publish click writes a fresh `updatedAt` and a fresh commit for a writer
  who changed nothing.
- **A pending-transition flag on the Draft row** — record that a publish is owed and consume it
  at the next Publish. Fails outright: a Synced Draft is deleted, so after a Save to GitHub
  there is no row left to hold the flag by the time Publish is clicked.
- **A provenance record distinguishing Kobun-authored Sources** — whatever shape it took, in
  the content or beside it. Unnecessary once the action decides `status`, and there is nowhere
  durable to put it that survives the delete.
- **Publish always visible, inert without the Feature** — no rename for existing Collections,
  but the same button would declare Publication State in one Collection and merely move bytes
  in another.
- **Both buttons always visible** — with the Feature off they would commit identical bytes,
  which is a difference the writer has to discover is not one.
- **Publish flipping to Unpublish once the item is live** — removes the commonest action, a
  re-commit of a published item's edits, exactly when the item is published.
- **Suspending autosave while Save to GitHub is the primary** — one setting, one meaning, and
  "Saved" would never be ambiguous. Rejected: a dropdown set once, possibly weeks earlier,
  would silently turn off crash protection, and the failure mode is losing an afternoon's work
  to a closed laptop with no dialogue at all.
- **Gating Save to GitHub on validation when the `publish` Feature is off** — so that every
  Collection keeps at least one gated path. Rejected: it makes a Feature flag change what an
  unrelated button refuses, and the refusal would have to explain a distinction the writer
  never made.

## Consequences

- **The glossary's spine moves.** `CONTEXT.md` defined **Publish** as "committing a Draft's
  content to its Source" — that is now **Commit**, and **Published Revision**, **Dirty**,
  **Clean**, **Synced**, **Rebase** and **Stale Source** are all facts about reconciliation with
  the repository rather than about publication. **Published Revision** becomes **Committed
  Revision**, renamed through to `editor_draft.published_revision` and `published_at`. "Commit"
  is the word the code and GitHub already use, so this adopts vocabulary rather than inventing
  it.
- **"Is it in the repository?" and "is it published?" become independent**, and all four
  combinations are reachable. The Collection list carries one column mixing both vocabularies,
  with the Draft's state winning and hiding the Source's Publication State, and mapping a Clean
  Draft to `PUBLISHED` — which becomes a lie the moment an item can be committed as `draft`.
  The dashboard carries the identical collision. Publication State must always come from the
  Source, with the Draft's state as a separate marker beside it, never a replacement.
- **Autosave to D1 always runs**, whatever the split control's primary is. The header's status
  line must name its target rather than saying a bare "Saved", which a writer whose primary
  button says "Save to GitHub" can reasonably read as "committed". When Save to GitHub is the
  primary and the repository is behind, navigating away warns.
- **Unpublish is left to its own ticket.** It is not needed to make this design whole: a writer
  can set Status to Draft in the properties panel and Save to GitHub, which commits their value
  verbatim by construction. Whether that deserves a button of its own is a separate question
  with its own trade-offs.
- **The commit message distinguishes the two.** Save to GitHub keeps `Create|Update <path> with
  Kobun`; Publish uses `Publish <path> with Kobun`. The publish is the notable event in a
  reviewer's history; a plain commit is a file change.
- **ADR-0005's Save to GitHub constraint is discharged.** Its statement that "until that action
  exists, every file Kobun commits is published by construction" stops being true here.

## References

- Grilling: [#90](https://github.com/aureliushq/kobun/issues/90) · Tickets:
  [#91](https://github.com/aureliushq/kobun/issues/91) → ([#107](https://github.com/aureliushq/kobun/issues/107) ∥ [#126](https://github.com/aureliushq/kobun/issues/126) ∥ [#127](https://github.com/aureliushq/kobun/issues/127))
- Left open deliberately: [#128](https://github.com/aureliushq/kobun/issues/128) (Unpublish)
- [ADR-0005](./0005-features-expand-into-managed-fields.md) — Managed Fields, the `status` Field,
  and the never-backfill rule this amends
- [ADR-0001](./0001-drafts-module-owns-publish-via-sourcestore-port.md) — the commit → guarded
  sync → delete-when-Synced chain both actions run, and typed refusals
- [ADR-0002](./0002-content-document-fidelity-via-original-raw.md) — Data as the home for
  Publication State's value
- [#87](https://github.com/aureliushq/kobun/issues/87) — the stamping rules and the ordering
  hazard, amended above
- Glossary terms: **Commit**, **Save to GitHub**, **Committed Revision** — named here, alongside
  the amended **Publish** and **Publication State**
