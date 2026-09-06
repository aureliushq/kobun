# Config is served from the D1 cache, revalidated on a short TTL

Every content route re-fetched and re-validated the Kobun config from GitHub on every navigation (`fetchAndParseConfig` probes up to 3 `CONFIG_PATHS`, then runs Zod), while a parsed copy sat unread in the `project` row (`configData`/`configSha`/`configCheckedAt` — written by setup and dashboard sync, read by nothing). The project-context seam now owns this decision: serve the cached `configData` when `configCheckedAt` is within a short TTL (~60s); past the TTL, conditionally re-fetch only the cached `configPath` (ETag/sha — GitHub 304s don't count against rate limit) and opportunistically rewrite the row. There is no GitHub webhook handler, so revalidation is the *only* invalidation signal — the TTL is the staleness bound, not an optimization knob.

Negative results are cached symmetrically: `MISSING`/`ERROR` statuses are served from the row under the same TTL, so a broken-config repo doesn't pay the 3-path probe on every navigation. On revalidation, a 404 at the cached `configPath` falls back to the full `CONFIG_PATHS` probe (handles the user renaming `.kobun.json` → `.kobun.yml`).

Stale config is a correctness concern — the Config drives editor fields and publish validation — but config edits are rare and typically made by the same person using the app, so a ≤60s window is acceptable and self-healing. User-visible consequences a future reader will meet: a config change (or fix) pushed to the repo can take up to the TTL to appear in the app; visiting the dashboard sync still refreshes immediately.

## As implemented

Four things the decision above left open, settled while building it:

- **The conditional token is a stored ETag**, in a new nullable `project.config_etag`. A blob sha is content-addressed and would tell us just as truthfully whether the Config changed, but only GitHub's own ETag buys the 304 — and a 304 is the point, since it costs no rate limit. A 200 whose sha matches the stored one is still short-circuited without re-parsing, which covers a rotated ETag and makes `config_sha` a column something finally reads.
- **A revalidation only trusts an ETag or a sha when the row remembers a file at that path.** A status this module never wrote says nothing about the repository; a row marked `MISSING` remembers no file, while the dashboard sync leaves the previous ETag on it; and a Project may have been connected before connecting learned to write a parsed Config at all (see the amendment below), leaving a fresh `configCheckedAt` and a `PRESENT` status over an empty `configData`. Each of those revalidates unconditionally. Sending a stale validator would answer a Config that has been *restored* byte for byte with a `304` — and so with "still missing", past every window, for good.
- **A Config that disappears keeps the path it was last found at**, diverging from `syncProjectConfig`'s reset to `.kobun.json`. The path is a memory of where this Project's Config lives, and so the best first guess when a deleted one is restored.
- **A repository that cannot be reached is not a Config that is broken.** Where the old live fetch turned every non-404 failure into a parse error, the cache serves the stale Config if it has one and, either way, writes nothing. A Project with nothing cached still refuses during a blip — the resolver has no vocabulary for "unavailable" — but because the blip is never written down, the very next request recovers, rather than the next window. Only the port is guarded: a failed database write is a real failure and still propagates. For related reasons the row rewrite carries `updatedAt` through by hand — revalidating is news about the Config, not a change to the Project, and setup orders its recent-Projects list by that column. A dashboard sync landing between the read and the rewrite has its `updatedAt` rolled back by a few milliseconds; that is the accepted last-write-wins race, and far cheaper than reordering the list on every navigation.

The rewrite touches only `configCheckedAt`, `configData`, `configEtag`, `configPath`, `configSha`, and `configStatus`. `configError` and the Project's own `status` stay with the dashboard sync that writes them. (`configError` no longer does — see the second amendment below.)

## Amendment: connecting a repository goes through the sync

Settled while moving the last two layouts onto the seam (#67), which asked that raw
fetch-and-parse have one caller outside the module.

`setup.tsx` used to run `fetchAndParseConfig` itself and spell out the Config columns in its
upsert — writing `configPath`, `configStatus`, `configCheckedAt` and `configError`, but never
`configData`, which is the unservable row the bullet above was written about. It now writes only
what a Project *is* — which repository, through which installation — with `configPath` and
`configStatus` as placeholders (`CONFIG_PATHS[0]` and `UNKNOWN`, both columns being `NOT NULL`),
and hands the row to `syncProjectConfig`. So the two paths that answer "go and look at this
repository now" are one path, and a Project is browsable from its first navigation instead of
paying a revalidation for it.

Two consequences a future reader will meet. Rows written by the old setup still exist and still
revalidate unconditionally, which is why that rule is stated over the row's contents rather than
over who wrote it. And a Project whose sync fails now survives as a row with `configStatus`
`UNKNOWN` and no check time, where before the failure left no row at all: unservable, so the very
next navigation resolves it against GitHub, which is the same self-healing the blip case relies on.

## Amendment: `configError` follows `configStatus`

Settled while closing #81, and named as the obvious next step by
[ADR-0007](./0007-a-project-with-no-config-still-has-a-dashboard.md).

The rule above split one fact across two writers. `configStatus` said *that* the Config could not
be read and was kept fresh by the cache; `configError` said *what* was wrong with it and was
written only by `syncProjectConfig`, which runs on connect and on "Refresh configuration" and
never in between. So the dashboard, which renders `configError`, described whatever the
repository looked like at the last sync rather than at the navigation the reader is making:

- a Config that was invalid at connect and then *deleted* resolved `MISSING`, over stored errors
  still naming the fields of a file that is no longer there;
- a Config that broke *after* connecting resolved `ERROR` with nothing stored, so the dashboard
  fell back to a message that says nothing.

`configError` is news about the Config, so it now moves with the other Config columns: every
`recordCheck` that writes a status writes the matching errors, a probe that finds nothing stores
`no_config`, and the two paths that re-parse nothing — a `304`, and a rotated ETag over a
matching sha — carry the stored errors through untouched. The Project's own `status` stays with
the sync, which is the half of the old rule that was about a different fact.

Two things fell out of it. A `parse_error` is now scoped to the path it was read from, because
the validator is told the Format and not the file — by `scopeConfigErrors` in
`packages/config/errors.ts`, beside the `parseConfigErrors` that reads the column back, so both
writers spell it the same way and neither renders an empty filename. And `ConfigProblem` gained
a third member,
`config-unreadable`: with fresh errors behind `config-invalid`, that arm now means "kobun read
this and it is broken", which is exactly what an unreachable repository must not be reported as
— the vocabulary this ADR noted was missing. The resolver reports `config-invalid` only for a
status the cache actually wrote as `ERROR`, and everything else it cannot classify as
`config-unreadable`.

## Considered options

- **Always fetch from GitHub (status quo)** — zero staleness, but 1–3 GitHub round-trips + Zod on every page load, and the cache columns stay write-only dead weight.
- **Always revalidate via ETag** — zero staleness window and skips the probe loop, but keeps one GitHub round-trip on every navigation, so latency barely improves.
- **Trust cache until explicit sync** — fastest, but a config edit made outside the dashboard goes stale indefinitely; unbounded staleness on a correctness-bearing artifact.
- **Delete the cache columns** — the honest deletion-test option, but forfeits the hot-path win the seam was partly justified by.
- **Only cache successes** — instant feedback while fixing a broken config, but broken-config repos re-probe 3 paths per navigation forever; rejected for a uniform rule.
