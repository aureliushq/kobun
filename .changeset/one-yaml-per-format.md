---
"kobun": minor
---

A date or datetime in `md`/`mdx` frontmatter now reads back as the text it was written with. Frontmatter was parsed by js-yaml (YAML 1.1), which turns date-shaped scalars into `Date` objects, while `.yaml` Sources were parsed as YAML 1.2 and kept them as strings — so the same authored value meant different things, and got opposite validation verdicts, depending on the Collection's Format. A zoneless `2026-07-14T09:30:00` silently acquired a `Z`; a `2026-07-14T00:00:00.000Z` lost its time and was then reported as malformed. Both Formats now use one YAML implementation.

This makes `md`/`mdx` frontmatter YAML 1.2 core, matching `.yaml` Sources: `yes`/`no`/`on`/`off` are strings rather than booleans, and `0644` is `644` rather than octal. `true`/`false` are unchanged.
