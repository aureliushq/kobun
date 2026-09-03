# kobun

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
