---
status: accepted
---

# Staged Images are forgotten when no Draft links them

A Staged Image lives only in R2, under `<projectId>/<id>`, and the only thing that refers to
it is a link in a Draft's Markdown. A Commit forgot the images it wrote (#178), but nothing
else did: a discarded Draft, a disconnected Project, a deleted account and an image deleted
from the Body before any Commit all left objects behind for good. [#215]

The rule is one sentence: **an image goes once no Draft of its Project links to it**. A link
anywhere keeps it, because a Draft that links a missing image has its next Commit refused
(ADR-0008). That includes the Draft that has just committed, when another session saved over
it and it survives the commit still holding the staged links: its images wait for a later
Commit, once the editor has followed them to the repository.

| When | What is forgotten |
| --- | --- |
| A Commit lands | the images it wrote, and any image a day old, that no Draft links |
| A Draft is discarded | the images its Body linked, that no other Draft links |
| A Project is disconnected, or its account deleted | every key under the Project's prefix |

Images deleted from a Body are swept **at Commit time**, not by a scheduled job. The sweep
lists the Project's prefix and needs no new infrastructure: no Cron Trigger, no `scheduled`
handler, no walk over the whole bucket. The cost is that a Project that never commits again
keeps its strays until it is disconnected; if that, or a Project holding thousands of images,
starts to matter, a scheduled sweep can apply the same rule.

The day of grace protects an image no Draft links *yet*: an upload the editor has not saved
into its Draft, or an image deleted that the writer may undo back.

An upload that lands while its Project is being disconnected can outlive the prefix sweep,
with no Project left to sweep it again. The window is one request wide, so it is accepted.

Forgetting is never allowed to fail the act that triggered it. The Commit has landed, the
Draft is discarded, the Project is gone; an image left behind costs storage and nothing else.
