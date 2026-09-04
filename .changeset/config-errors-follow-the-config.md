---
"kobun": patch
---

The dashboard now tells you what is wrong with your configuration as of this page load, not as of the last time the Project was connected or refreshed. Only that sync wrote the stored error list, while the Config cache every navigation resolves through kept the *status* fresh — so a `.kobun.json` that broke after connecting showed a message saying nothing, and one that was invalid and then deleted showed the old validation errors about a file that is no longer there. The cache now writes the errors alongside the status it already owned.

Two Configs that parsed to nothing without saying why now say why: an empty or comment-only `.kobun.yml` is reported as a parse error rather than crashing the page, and a Config declaring an empty `collections` map is reported as declaring nothing rather than as a repository kobun could not reach.

"Kobun could not reach or read this repository's configuration" is now shown only when that is what happened. It used to stand in for a broken Config as well.
