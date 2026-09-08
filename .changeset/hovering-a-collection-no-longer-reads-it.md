---
"kobun": patch
---

Hovering the sidebar no longer reads a Collection off GitHub every time. Every sidebar link warms the page behind it on hover, so sweeping the mouse past a dozen Collections asked GitHub to read a dozen directories in full — the text of every file in each — for pages you never opened. The Collection listing is now cached the way your configuration already was: served straight from Kobun for a minute, then checked with one cheap conditional request, and a directory that has not changed answers without costing anything. Publishing or saving an item forgets the directory it wrote into, so the listing you land on is still the one you just changed.

One thing that used to be silently wrong is fixed with it: when Kobun could not reach your repository at all, the Collection page said the Collection was empty. It now says the listing is unavailable, which is what happened.
