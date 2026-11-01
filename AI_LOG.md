# AI Log

Kept while working, not written at the end.

## Tools

- **Claude Code** (Claude Opus 5.5) in the VS Code extension. I used it to plan, read the Wix API docs, drive a
  headless browser to record network calls, call the API, and draft the docs and the test code.
- Agent configuration committed in this repo:
  - [`CLAUDE.md`](CLAUDE.md): rules for the agent (no purchases, API budget, no secrets, assert rules not data)
  - [`.claude/settings.json`](.claude/settings.json): blocks the agent from reading `.env`
  - [`.claude/skills/live-change/SKILL.md`](.claude/skills/live-change/SKILL.md): a skill for live changes. It explains each step out loud, makes the smallest change, runs only that test, and stops before committing.

## Key prompts

1. *"Create a plan for the followling assignment"*, with the full assignment pasted in. The result was a phased plan with time
   boxes, kept private and not committed.
2. *"divide the plan to phases."* The agent executed the plan phase by phase while I answered questions and corrected it.
3. Corrections given mid-way:
   - *"Follow the instructions they're asking, no need to copy [my other repos], before each write provide explanation"*
   - *"The diagram can be in Mermaid format"*
   - *"provide the URLs, I'll check it each one"*
   - *"Add tests for the Name Generator and WHOIS too as an extra with explanation on each"*, so all four doors are automated, not only the required API + one web door.
   - *"Don't stage, commit or push before I approve."* From then on, commits stayed local until I had reviewed them.


## Where the AI was wrong, and how it was caught

| What the AI did | How it was caught | What changed |
|---|---|---|
| Guessed two URLs for the Wix API-key docs | Both returned 404 or redirected | Found the right pages through the docs index (`llms.txt`) |
| Repeated the docs: "the account ID is required" | My first call had no account ID (a typo in my `.env`) and still returned 200 | Became a finding to check, not an assumption (FINDINGS #1, #3) |
| Started naming the repo in the style of my other repos | I told it to follow the assignment | Plain repo name |
| Its network recorder filtered out every URL containing "google", so the `google.com` search lost its most important calls | The capture had no availability check for google.com itself | Filter on host names only, then re-ran |
| Read the 64-character and pasted-URL pages as "no error message", because its text filter missed those lines | The screenshots showed a message on both | Rewrote the finding around what the messages *say* (FINDINGS #4) |
| Its first two automated hovers on the price (i) icon captured nothing, then hit a banner with the same words | A third try with an exact text match | The tooltip says "Renews at ₪90.19", so my renewal "bug" became an **observation** |
| The first storefront test clicked before the page's JavaScript was running, so the click did nothing | The failure snapshot showed the name typed in but no navigation | Wait for the page's own pricing call as a "ready" signal, not a fixed sleep |
| `.first()` matched a hidden copy of the domain name | Failure: "unexpected value hidden" | Filter to visible elements |
| A code comment claimed "single-word queries **never** page", based on 2 samples | Review of its own diff | Reworded to what was actually observed |

## What I changed or threw away

- **The paging test failed, and I didn't hide it.** Instead of changing the query until the test passed, I
  checked a second query by hand. It became FINDINGS #5 and a known-failure test.
- Merged two small storefront wording issues into one finding, to make room for the paging bug.
- Dropped the renewal-price "bug" (see above). It's an observation now.
- The exploration scripts (network recorder, tooltip probes) stay out of the repo. They were one-off, and
  their raw output contains session tokens.
- Removed `npm init` defaults from `package.json` that nothing used.
- The 5-line quality strategy in the README started from an AI draft; I reviewed it and kept it.

## What I did not hand to AI

- Creating the Wix account and the API key, and choosing the key's permission. The form defaults to
  "All permissions"; I narrowed it to **Manage Domains** only.
- The key itself. It was never pasted into the chat. The agent first checked only its length, and later my
  `.env` deny rule blocked it from reading the file at all. It hit that block once, when it tried to read
  `.env` for a manual call, and switched to a call that needed no key.
- Checking the live pages myself. 
- The final review of every file before submitting. 
- Severity and priority. The agent proposed one for each finding, with a reason, the final call was mine: I reviewed all 5 and approved them.
