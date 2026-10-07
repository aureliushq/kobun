---
"kobun": minor
---

Editor image uploads now go to R2 staging and get committed to the repo's media directory on Save to GitHub and Publish. This also fixes several editor, Save to GitHub and account-settings bugs. Collections are now read from `<basePath>/collections/<collection>/`, alongside `<basePath>/singletons/`; move existing Collection directories there.
