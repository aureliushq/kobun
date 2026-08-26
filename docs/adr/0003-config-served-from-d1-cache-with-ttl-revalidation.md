# Config is served from the D1 cache, revalidated on a short TTL

Every content route re-fetched and re-validated the Kobun config from GitHub on every navigation (`fetchAndParseConfig` probes up to 3 `CONFIG_PATHS`, then runs Zod), while a parsed copy sat unread in the `project` row (`configData`/`configSha`/`configCheckedAt` — written by setup and dashboard sync, read by nothing). The project-context seam now owns this decision: serve the cached `configData` when `configCheckedAt` is within a short TTL (~60s); past the TTL, conditionally re-fetch only the cached `configPath` (ETag/sha — GitHub 304s don't count against rate limit) and opportunistically rewrite the row. There is no GitHub webhook handler, so revalidation is the *only* invalidation signal — the TTL is the staleness bound, not an optimization knob.

Negative results are cached symmetrically: `MISSING`/`ERROR` statuses are served from the row under the same TTL, so a broken-config repo doesn't pay the 3-path probe on every navigation. On revalidation, a 404 at the cached `configPath` falls back to the full `CONFIG_PATHS` probe (handles the user renaming `.kobun.json` → `.kobun.yml`).

Stale config is a correctness concern — the Config drives editor fields and publish validation — but config edits are rare and typically made by the same person using the app, so a ≤60s window is acceptable and self-healing. User-visible consequences a future reader will meet: a config change (or fix) pushed to the repo can take up to the TTL to appear in the app; visiting the dashboard sync still refreshes immediately.

## As implemented

Four things the decision above left open, settled while building it:

- **The conditional token is a stored ETag**, in a new nullable `project.config_etag`. A blob sha is content-addressed and would tell us just as truthfully whether the Config changed, but only GitHub's own ETag buys the 304 — and a 304 is the point, since it costs no rate limit. A 200 whose sha matches the stored one is still short-circuited without re-parsing, which covers a rotated ETag and makes `config_sha` a column something finally reads.
- **A revalidation only trusts an ETag or a sha when the row remembers a file at that path.** Connecting a repository stamps a fresh `configCheckedAt` and a `PRESENT` status without ever writing `configData` (`setup.tsx`); a status this module never wrote says nothing about the repository; and a row marked `MISSING` remembers no file, while the dashboard sync leaves the previous ETag on it. Each of those revalidates unconditionally. Sending a stale validator would answer a Config that has been *restored* byte for byte with a `304` — and so with "still missing", past every window, for good.
- **A Config that disappears keeps the path it was last found at**, diverging from `syncProjectConfig`'s reset to `.kobun.json`. The path is a memory of where this Project's Config lives, and so the best first guess when a deleted one is restored.
- **A repository that cannot be reached is not a Config that is broken.** Where the old live fetch turned every non-404 failure into a parse error, the cache serves the stale Config if it has one and, either way, writes nothing. A Project with nothing cached still refuses during a blip — the resolver has no vocabulary for "unavailable" — but because the blip is never written down, the very next request recovers, rather than the next window. Only the port is guarded: a failed database write is a real failure and still propagates. For related reasons the row rewrite carries `updatedAt` through by hand — revalidating is news about the Config, not a change to the Project, and setup orders its recent-Projects list by that column. A dashboard sync landing between the read and the rewrite has its `updatedAt` rolled back by a few milliseconds; that is the accepted last-write-wins race, and far cheaper than reordering the list on every navigation.

The rewrite touches only `configCheckedAt`, `configData`, `configEtag`, `configPath`, `configSha`, and `configStatus`. `configError` and the Project's own `status` stay with the dashboard sync that writes them.

## Considered options

- **Always fetch from GitHub (status quo)** — zero staleness, but 1–3 GitHub round-trips + Zod on every page load, and the cache columns stay write-only dead weight.
- **Always revalidate via ETag** — zero staleness window and skips the probe loop, but keeps one GitHub round-trip on every navigation, so latency barely improves.
- **Trust cache until explicit sync** — fastest, but a config edit made outside the dashboard goes stale indefinitely; unbounded staleness on a correctness-bearing artifact.
- **Delete the cache columns** — the honest deletion-test option, but forfeits the hot-path win the seam was partly justified by.
- **Only cache successes** — instant feedback while fixing a broken config, but broken-config repos re-probe 3 paths per navigation forever; rejected for a uniform rule.
