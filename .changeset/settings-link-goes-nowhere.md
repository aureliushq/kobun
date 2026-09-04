---
"kobun": patch
---

The Settings link is gone from the sidebar footer. It pointed at `/settings`, a route Kobun has never had, so clicking it landed on the 404 boundary — and because it sat beside Logout it read as a working part of the chrome rather than something unfinished. It was also the last link in the sidebar left without prefetching, since warming a 404 on every hover is worse than not warming it.

Settings return as a real page rather than a restored link: one for the Project and one for the account, with the rule for who owns which setting written down first.
