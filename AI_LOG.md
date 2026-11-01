# AI Log

Kept while working, not written at the end.

## Tools
- **Claude Code** (Claude Opus 5.5) in the VS Code extension: planning, reading the Wix API docs,
  driving a headless browser to record network calls, drafting docs and test code.
- Agent configuration committed in this repo: [`CLAUDE.md`](CLAUDE.md) (rules for the agent)
  and [`.claude/settings.json`](.claude/settings.json) (blocks the agent from reading `.env`).

## Key prompts
1. *"Create a plan for this"* plus the full assignment text. The result was a phased plan with
   time boxes, kept private and not committed.
2. *"Follow the plan"*: the agent then executed each phase, and I reviewed and corrected along the way.

## Where the AI was wrong, and how it was caught
- **Doc links:** the agent guessed two URLs for the Wix API-key docs. Both returned 404 or
  redirected elsewhere. It found the right pages through the docs index (`dev.wix.com/docs/llms.txt`).
- **"The account ID is required":** the docs say so, and the agent repeated it. My first test call
  had no account ID, because I saved it under the wrong variable name, and it still returned
  HTTP 200. That turned an assumption into a finding to check (see FINDINGS.md).
- **Repo naming:** the agent started copying the naming style of my other GitHub repos.
  I told it to follow the assignment instead, so the repo has a plain name.

## What I changed or threw away
- (filled in as I go)

## What I did not hand to AI
- Creating the Wix account and the API key, and choosing the key's permission. The form defaults
  to "All permissions"; I narrowed it to **Manage Domains** only.
- The key itself. It was never pasted into the chat. The agent only checked its length and
  made one test call that read it from `.env`.
