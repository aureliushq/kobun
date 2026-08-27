---
"kobun": patch
---

The dashboard and the editor now resolve your Project the same way the pages inside them do: a kobun config that is missing or cannot be read sends you to setup instead of crashing, and navigating between pages no longer re-fetches that config from GitHub every time. Connecting a repository also stores its config straight away, so the first page you land on is already fast.
