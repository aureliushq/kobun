---
"kobun": patch
---

The sidebar logo and the header "Home" breadcrumb now navigate to the active Project's dashboard. Both pointed at an empty path that React Router resolved to the current URL, so clicking either did nothing. Both now prefetch on intent, like every other sidebar destination.
