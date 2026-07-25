# Config is served from the D1 cache, revalidated on a short TTL

Every content route re-fetched and re-validated the Kobun config from GitHub on every navigation (`fetchAndParseConfig` probes up to 3 `CONFIG_PATHS`, then runs Zod), while a parsed copy sat unread in the `project` row (`configData`/`configSha`/`configCheckedAt` — written by setup and dashboard sync, read by nothing). The project-context seam now owns this decision: serve the cached `configData` when `configCheckedAt` is within a short TTL (~60s); past the TTL, conditionally re-fetch only the cached `configPath` (ETag/sha — GitHub 304s don't count against rate limit) and opportunistically rewrite the row. There is no GitHub webhook handler, so revalidation is the *only* invalidation signal — the TTL is the staleness bound, not an optimization knob.

Negative results are cached symmetrically: `MISSING`/`ERROR` statuses are served from the row under the same TTL, so a broken-config repo doesn't pay the 3-path probe on every navigation. On revalidation, a 404 at the cached `configPath` falls back to the full `CONFIG_PATHS` probe (handles the user renaming `.kobun.json` → `.kobun.yml`).

Stale config is a correctness concern — the Config drives editor fields and publish validation — but config edits are rare and typically made by the same person using the app, so a ≤60s window is acceptable and self-healing. User-visible consequences a future reader will meet: a config change (or fix) pushed to the repo can take up to the TTL to appear in the app; visiting the dashboard sync still refreshes immediately.

## Considered options

- **Always fetch from GitHub (status quo)** — zero staleness, but 1–3 GitHub round-trips + Zod on every page load, and the cache columns stay write-only dead weight.
- **Always revalidate via ETag** — zero staleness window and skips the probe loop, but keeps one GitHub round-trip on every navigation, so latency barely improves.
- **Trust cache until explicit sync** — fastest, but a config edit made outside the dashboard goes stale indefinitely; unbounded staleness on a correctness-bearing artifact.
- **Delete the cache columns** — the honest deletion-test option, but forfeits the hot-path win the seam was partly justified by.
- **Only cache successes** — instant feedback while fixing a broken config, but broken-config repos re-probe 3 paths per navigation forever; rejected for a uniform rule.
