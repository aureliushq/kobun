---
status: accepted
---

# A Project whose Config cannot be read still has a dashboard

Connecting a repository ended with `redirect("/:owner/:name")`, and the dashboard layout there
opened with `requirePageContext`, which resolved the Project *and* its Config and refused
whenever the Config was missing or would not validate. `toPageContext` turned every refusal
that was not `anonymous` into a redirect to `/setup` — the page the writer had just submitted
from. So connecting a repository with no `.kobun.json` bounced them straight back, with
nothing said, and the Project they had in fact just created was unreachable: clicking "Open"
on it went the same way. [#97]

The mistake was treating "this repository declares nothing" as the same answer as "you have
no Project for this repository". Only the second is something setup can do anything about.
The resolver now reports the first on its **success** arm — the same access, with `config:
null` and a `configProblem` saying which of the two it is — and each translator decides what
that means for its own kind of page:

| Page | Config present | Config missing or invalid | No Project | Anonymous |
| --- | --- | --- | --- | --- |
| dashboard layout, `/:owner/:name` | renders | renders, and says what is wrong | → `/setup` | → `/login` |
| collection, singleton, editor | renders | → `/:owner/:name` | → `/setup` | → `/login` |
| `api.repo-asset` | skips the Config | skips the Config | 404 | 401 |

A page that addresses content still cannot render without a Config, so it still leaves — but
to the Project's own dashboard rather than to setup, because the Project exists. `/setup` is
now reached from exactly one refusal, `no-project`, which is the only one it answers.

The refusal carries the access it already resolved rather than collapsing to a bare reason,
which is what makes the second row of that table expressible at all: `toPageContext` needs the
owner and the name to say where to send the reader, and a `{ ok: false, reason }` has neither.

## What the dashboard renders

`dashboard.tsx` was already written for this and could not be reached: its `ConfigAlert`
switch has arms for `no_config` and `parse_error`, but it read them off `config.errors`, and
a `config` that is non-null is by definition one that parsed. Those two arms were dead code.
They now render from `project.configError` — the JSON error list `syncProjectConfig` writes
when a repository is connected and on every "Refresh configuration" — falling back to a
message keyed by the problem when the column holds nothing to read. That fallback gets an
alert of its own rather than the validation one: `config-invalid` is also what an
*unreachable* repository resolves to (ADR 0003 gave the resolver no vocabulary for
"unavailable"), and a writer whose Config is fine must not be told it is broken.

That column is written by the sync and not by the config cache ([ADR 0003](./0003-config-served-from-d1-cache-with-ttl-revalidation.md)),
so a Config that breaks *after* connecting shows the fallback message until the writer
refreshes. The headline is always right, because the problem is resolved fresh; only the
detail can lag. Teaching the cache to write `configError` would fix that and is the obvious
next step if the fallback proves too thin — it is left out here because this ticket is about
the redirect, and the moment the detail matters most is the moment it is freshest.

## Considered options

- **Keep the redirect and give setup a message** — one less concept, and the writer is told
  something. But setup's whole vocabulary is "which repository", and a Project that exists
  would keep being answered by the page that exists to create one; the dashboard's Config
  alerts would stay unreachable, and "Open" would still bounce.
- **Make `config` nullable on every context** — fewer types, but every content route would
  have to re-decide what a null Config means, which is the drift the seam was built to end
  ([03-repo-context-seam](../architecture/03-repo-context-seam.md)).
- **A `{ config: "optional" }` flag on `resolve`** — rejected for the same reason the module
  has two wrappers rather than a mode flag: the core would be encoding an HTTP policy again.
- **Let the dashboard resolve with `{ config: false }`** — it already answers without a
  Config, and no new arm would be needed. But the dashboard *wants* the Config when there is
  one, for the sidebar; asking without it would mean a second resolution, or a sidebar that
  never lists anything.

## Consequences

- `ProjectContextRefusal` is down to `anonymous` and `no-project`, so `toApiContext` no longer
  maps two 422s it could not receive: `requireApiAccess` passes `{ config: false }`, and the
  union no longer contains them.
- `toPageContext` is now `toProjectPage` plus the one extra redirect, which is what the two
  pages actually differ by. The wrappers above them stay separate copies of three lines,
  matching `requireApiAccess`, because each earns a different return type.
- The `no_config` message moved to `packages/config/errors.ts`, so the fetch that discovers a
  missing Config and the dashboard that reports one no longer spell it out twice.
- The sidebar takes `NormalizedConfig | null` and collapses its Collections and Singletons
  groups when there is nothing to list. A Project with no Config shows Dashboard and nothing
  else, which is exactly what it has.
- `connectProject` now holds what setup's action used to do inline, behind two ports — one to
  list an installation's repositories, one to sync the Config it just connected. That is what
  makes "a successful setup submission reaches the dashboard" a test rather than a manual
  check; the route keeps the form, the analytics, and the redirect. Moving it also retired a
  `findFirst` that could not change the outcome: its only product was an id, and the upsert's
  conflict target is the very pair it looked the row up by.
- What that test does not cover is the wiring on either end — the route's form parsing and
  `redirect`, and the layout loader's own three lines — because reaching them means
  constructing a router context and a real authentication provider. The test asserts the path
  `connectProject` returns and resolves *that path*, so a redirect naming a repository the
  dashboard's lookup cannot find fails it.
