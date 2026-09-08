# kobun

## 0.5.0

### Minor Changes

- 3fda242: Save to GitHub is now its own action, one save button that remembers which one you meant, drafts and published state told apart in collection lists, cached collection listings, and one YAML parser behind every format.
- 391b467: Save and Save to GitHub are one button now. It does whichever of the two you used last, and the arrow beside it switches which one that is. The choice sticks: reload the page, open another item, come back tomorrow, and the button is still the one you left it on. If you have never chosen, it is Save — a draft kept in Kobun is the action that costs nothing to press by accident, and it is what autosave was doing anyway. Publish, in the collections that have it, is still its own button beside the two, because it still means something else.

  The menu says what each one does before you pick it, and the status line says which one it means afterwards. Work kept in Kobun reads "Draft saved, not on GitHub". Only a commit that reached the repository reads "Saved to GitHub". A bare "Saved" is gone, so a writer whose button says Save to GitHub can no longer read it as work that landed there.

  Autosave to Kobun runs whichever way you set the button, so nothing you type is riding on which one you picked. And if Save to GitHub is your button and you leave an item the repository does not have yet, Kobun tells you before you go — your draft is safe either way, it just isn't on GitHub.

  The button also stops changing width. Switching between the two, and running either, no longer nudges anything in the header sideways.

- 6c3ba09: A date or datetime in `md`/`mdx` frontmatter now reads back as the text it was written with. Frontmatter was parsed by js-yaml (YAML 1.1), which turns date-shaped scalars into `Date` objects, while `.yaml` Sources were parsed as YAML 1.2 and kept them as strings — so the same authored value meant different things, and got opposite validation verdicts, depending on the Collection's Format. A zoneless `2026-07-14T09:30:00` silently acquired a `Z`; a `2026-07-14T00:00:00.000Z` lost its time and was then reported as malformed. Both Formats now use one YAML implementation.

  This makes `md`/`mdx` frontmatter YAML 1.2 core, matching `.yaml` Sources: `yes`/`no`/`on`/`off` are strings rather than booleans, and `0644` is `644` rather than octal. `true`/`false` are unchanged.

- 763c9c6: The editor now has a **Save to GitHub** action beside Publish. It commits what you have written to the same file Publish would write, and it does nothing else — it never touches Status, so work in progress lands in the repository as the draft your Status field already said it was. It is not held back by a validation error or an empty body, because a backup of a half-written post is exactly what it is for. An unusable slug, a slug another item already uses, and a file that moved on GitHub still refuse: those are about where the bytes land, not whether the writing is finished.

  Publish now writes `status: published` every time, including onto a file that had no `status` key before. Nothing else writes Status at all, so an ordinary edit can no longer take a live post down by accident — and publishing something you had only backed up flips it and commits, rather than deciding nothing changed and doing nothing.

  Publish is gone entirely from Collections that do not turn the `publish` feature on. There is no publication state to declare there, so Save to GitHub is the only way to the repository.

  The two are told apart in the history: `Publish <path> with Kobun` for one, `Create`/`Update <path> with Kobun` for the other.

- 923a30e: A Collection's list now tells you two things about a row instead of running them together: whether the file is in your repository, and whether it is published. They used to share one column, and the draft you were editing hid whatever the repository said — so an item you had saved to GitHub as a draft read as **Published** the moment you stopped typing.

  Now the publication state always comes from the file itself, and the draft beside it is a marker of its own. A live post you are editing reads **Published · Uncommitted changes**. A draft you have backed up reads **Draft · Uncommitted changes**. Something you have started but never sent to GitHub reads **Not in repository**, and nothing more — there is no published-or-not to report about a file that is not there.

  The status filter now says which of the two it is filtering on, and filters on either. Filtering for **Published** keeps a live post you have unsaved edits on, which the old single column could not express.

  Dashboard cards use the same words, so a draft with nothing pending no longer calls itself "Published".

### Patch Changes

- 9476f22: The dashboard now tells you what is wrong with your configuration as of this page load, not as of the last time the Project was connected or refreshed. Only that sync wrote the stored error list, while the Config cache every navigation resolves through kept the _status_ fresh — so a `.kobun.json` that broke after connecting showed a message saying nothing, and one that was invalid and then deleted showed the old validation errors about a file that is no longer there. The cache now writes the errors alongside the status it already owned.

  Two Configs that parsed to nothing without saying why now say why: an empty or comment-only `.kobun.yml` is reported as a parse error rather than crashing the page, and a Config declaring an empty `collections` map is reported as declaring nothing rather than as a repository kobun could not reach.

  "Kobun could not reach or read this repository's configuration" is now shown only when that is what happened. It used to stand in for a broken Config as well.

- 432ccbb: The sidebar logo and the header "Home" breadcrumb now navigate to the active Project's dashboard. Both pointed at an empty path that React Router resolved to the current URL, so clicking either did nothing. Both now prefetch on intent, like every other sidebar destination.
- 1a3dd4c: Hovering the sidebar no longer reads a Collection off GitHub every time. Every sidebar link warms the page behind it on hover, so sweeping the mouse past a dozen Collections asked GitHub to read a dozen directories in full — the text of every file in each — for pages you never opened. The Collection listing is now cached the way your configuration already was: served straight from Kobun for a minute, then checked with one cheap conditional request, and a directory that has not changed answers without costing anything. Publishing or saving an item forgets the directory it wrote into, so the listing you land on is still the one you just changed.

  One thing that used to be silently wrong is fixed with it: when Kobun could not reach your repository at all, the Collection page said the Collection was empty. It now says the listing is unavailable, which is what happened.

- a682dcb: The Settings link is gone from the sidebar footer. It pointed at `/settings`, a route Kobun has never had, so clicking it landed on the 404 boundary — and because it sat beside Logout it read as a working part of the chrome rather than something unfinished. It was also the last link in the sidebar left without prefetching, since warming a 404 on every hover is worse than not warming it.

  Settings return as a real page rather than a restored link: one for the Project and one for the account, with the rule for who owns which setting written down first.

## 0.4.0

### Minor Changes

- f0a6312: New field types, a faster-loading editor and collection list, better draft handling, and error tracking.

### Patch Changes

- 5f80e03: Clicking a Collection Item now opens its editor straight away. The title, the properties panel and everything the header offers are there before GitHub answers, with a placeholder where your writing will be — the fields are greyed out until their values arrive, and Save and Publish stay out of reach until then, so neither can act on half a Draft. Starting a new item skips all of that: there is nothing to fetch, so there is nothing to wait for. An item that has been renamed or deleted on GitHub still answers with the same not-found page it always did, and a collection kobun cannot read still answers with the same error page — neither is dressed up as an editor you cannot type into.
- 3bd3762: A Collection now opens the moment you click it. Its name, its controls and the table frame are there straight away, with placeholder rows where your items will be, and the search and filters stay greyed out until they have something real to sort — the one button that never needs the list, New, works throughout. Switching between two Collections shows the new one's placeholders rather than holding you on the last one's rows. And if GitHub cannot answer, the page says so where the rows would be, with the heading and the New button still in place, instead of replacing everything with an error.
- 20c717c: The collection editor now answers an unconnected repository, or a missing or invalid kobun config, the same way every other content page does — setup for the first, the dashboard that reports the problem for the second — instead of a bare 404 or 422.
- ff6fdc1: The dashboard and the editor now resolve your Project the same way the pages inside them do: a kobun config that is missing or cannot be read no longer crashes them, and navigating between pages no longer re-fetches that config from GitHub every time. Connecting a repository also stores its config straight away, so the first page you land on is already fast.
- 91bd4eb: The dashboard now paints as soon as it knows which Project you are on, instead of waiting for everything it was going to show. Your Drafts fill in behind a placeholder of the right shape, and checking for a new kobun release no longer holds the page up — if that check is slow or never answers, you simply do not see an update notice. Every sidebar destination is now fetched as you move towards it, so the page is usually part-way loaded by the time you click.

## 0.3.3

### Patch Changes

- Fix incomplete React Router v8 migration

## 0.3.2

### Patch Changes

- Fix Github App ID

## 0.3.1

### Patch Changes

- chore: update deps

## 0.3.0

### Minor Changes

- dc367c5:
  - Add rich-text editor
    - markdown support
    - typography
    - images
    - emojis
    - callouts
  - Add save and publish workflow
  - Persist drafts to D1.

## 0.2.5

### Patch Changes

- 99bfec6: Dependabot updates

## 0.2.4

### Patch Changes

- bc2e139: Update D1 IDs

## 0.2.3

### Patch Changes

- 6a074a7: Add manifest for getting latest app version, changelog/release notes link, etc

## 0.2.2

### Patch Changes

- Fix more CI type issues

## 0.2.1

### Patch Changes

- 7b874e1: Fix type check issue in CI

## 0.2.0

### Minor Changes

- 40462a0: - Add zod schema definitions for configuration file
  - Add configuration parser and validator
  - Add config fetching from Github
  - Update project table schema and save serialized configuration in the database
  - Add JSON schema generation
  - Add types and exports for configuration
  - Update dashboard and sidebar UI
    - Update sidebar options
    - Add refresh configuration button

## 0.1.2

### Patch Changes

- 5e1aab9: - Add CONTRIBUTING.md and DEPLOYMENT.md
  - Update LICENSE: MIT -> FSL-1.1-MIT
  - Update README

## 0.1.1

### Patch Changes

- 1375d75: Add release scripts, workflows, and guide
