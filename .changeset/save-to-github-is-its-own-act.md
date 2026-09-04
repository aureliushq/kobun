---
"kobun": minor
---

The editor now has a **Save to GitHub** action beside Publish. It commits what you have written to the same file Publish would write, and it does nothing else — it never touches Status, so work in progress lands in the repository as the draft your Status field already said it was. It is not held back by a validation error or an empty body, because a backup of a half-written post is exactly what it is for. An unusable slug, a slug another item already uses, and a file that moved on GitHub still refuse: those are about where the bytes land, not whether the writing is finished.

Publish now writes `status: published` every time, including onto a file that had no `status` key before. Nothing else writes Status at all, so an ordinary edit can no longer take a live post down by accident — and publishing something you had only backed up flips it and commits, rather than deciding nothing changed and doing nothing.

Publish is gone entirely from Collections that do not turn the `publish` feature on. There is no publication state to declare there, so Save to GitHub is the only way to the repository.

The two are told apart in the history: `Publish <path> with Kobun` for one, `Create`/`Update <path> with Kobun` for the other.
