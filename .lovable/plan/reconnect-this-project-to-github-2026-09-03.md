# Reconnect this project to GitHub

## What's actually wrong

The GitHub URL in the docs (`fastresults/eyeframe-showcase`) is stale. This project has **no GitHub repo connected** — its only Git remote is Lovable's internal store. A 404 on that URL is the expected result: either the repo never existed under that account, or it was deleted/renamed/made private after the docs were written. Nothing in the code points at it; it's only a line of prose in `CLAUDE.md`.

## Fix

### 1. Connect GitHub (you do this, in the editor)

Plus (+) menu in the chat input → **GitHub** → **Connect project** → authorize the Lovable GitHub App → pick the `fastresults` account/org → **Create Repository**.

Notes:
- If a repo named `eyeframe-showcase` still exists in that org but is private/inaccessible, either grant the Lovable GitHub App access to it or create the new repo under a different name.
- Only one GitHub account can be linked to a Lovable account at a time — if the wrong account is authorized, disconnect it first.
- Lovable cannot import an existing GitHub repo; it creates a fresh repo from this project's current code and then syncs both ways.

### 2. Correct the stale documentation (I do this after you confirm)

Update the `Repo:` line in `CLAUDE.md` to the real repo slug once the connection exists — or, if you'd rather not re-pin it, replace it with a pointer to the editor's GitHub menu so it can't go stale again.

## Out of scope

No application code, routes, or backend changes. This is a project-settings action plus a one-line docs correction.
