---
"kobun": minor
---

A Collection's list now tells you two things about a row instead of running them together: whether the file is in your repository, and whether it is published. They used to share one column, and the draft you were editing hid whatever the repository said — so an item you had saved to GitHub as a draft read as **Published** the moment you stopped typing.

Now the publication state always comes from the file itself, and the draft beside it is a marker of its own. A live post you are editing reads **Published · Uncommitted changes**. A draft you have backed up reads **Draft · Uncommitted changes**. Something you have started but never sent to GitHub reads **Not in repository**, and nothing more — there is no published-or-not to report about a file that is not there.

The status filter now says which of the two it is filtering on, and filters on either. Filtering for **Published** keeps a live post you have unsaved edits on, which the old single column could not express.

Dashboard cards use the same words, so a draft with nothing pending no longer calls itself "Published".
