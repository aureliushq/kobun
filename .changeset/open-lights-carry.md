---
"kobun": patch
---

Three fixes: a slug field can now sit inside an object field and fills in from a text field beside it as you type; a document field inside an object or array field, or a slug field in an array, is now flagged as a config error instead of breaking the editor; and after each release, every project's config is checked again once, so a config that was accepted before is not kept after the rules change.
