# Wix Domains: QA home assignment

**Time spent:** Approximately 2hrs
  
How Wix answers "Can I get this name?" through four doors, and how I'd own its quality.

| File | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | What each door is made of, the network calls behind it, how the doors connect (Mermaid diagram) |
| [TEST_PLAN.md](TEST_PLAN.md) | Scope, ranked risks, approach, and what I left out and why |
| [FINDINGS.md](FINDINGS.md) | 5 findings with evidence, severity and priority, plus observations |
| [AI_LOG.md](AI_LOG.md) | How I used AI, where it was wrong, and what I didn't hand to it |
| [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json), [.claude/skills/live-change](.claude/skills/live-change/SKILL.md) | Rules for the AI agent, a rule blocking it from reading `.env`, and a skill for safe live changes |

## How to run the tests

Requires Node 18+ (tested on Node 25) and a free Wix account.

```bash
npm ci
npx playwright install chromium
cp .env.example .env     # then fill in both values (below)
npm test                 # everything: API + UI, about 20 seconds
```

**`.env` values:** create a key at https://manage.wix.com/account/api-keys.
- Give it only the **Manage Domains** permission (under account permissions).
- Copy the key into `WIX_API_KEY`, and the Account ID shown on the same page into `WIX_ACCOUNT_ID`.

**Other commands:**
- `npm run test:api` runs only the API tests
- `npm run test:ui` runs only the browser tests
- `npm run report` opens the HTML report

**What a good run looks like:** every test passes. Three tests show as `x`. These are **known API bugs**
(FINDINGS.md #1 and #5), marked as expected failures with `test.fail()`. If one of them ever "passes",
Wix has changed that behavior and the report will flag it.

**Without a key:** the API and cross-door tests are skipped with a clear message. The browser tests
(storefront, name generator, WHOIS) and the auth tests still run.

**Good to know:**
- The tests run against **production**.
- Prices and some suggestions depend on where you run from. The tests check formats and rules,
  not amounts, so they pass from anywhere.
- One full run makes about **27 public API calls**. Building this repo (exploration + test runs) used about 110.

## What I automated, and why

| Area | Tests | Why this, and why this deep |
|---|---|---|
| **Public API contract** | 18 in `tests/api/` | The answer to "can I get it?" lives here, and every door uses the same service (ARCHITECTURE.md). Fast (seconds) and stable. Covers happy paths, the documented errors, limits, paging, and a "suggested ⇒ really available" cross-check. |
| **Storefront** (one web door) | 2 in `tests/ui/` | The main door most users use. Covers the taken and free states. Each screen is checked **against the backend response the page received**, so a mismatch between data and screen is caught. |
| **Business Name Generator** | 1 in `tests/ui/` | The names are AI-generated, so the test reads them from the response and checks that all 9 are on screen, and that domains are suggested for the first name. It never expects fixed names. |
| **WHOIS** | 2 in `tests/ui/` | A registered domain shows its real creation date, from the public RDAP record. A free name has no record and leads to the buy page. The timezone is pinned to UTC (see the observations in FINDINGS.md). |
| **Cross-door consistency** | 2 in `tests/cross-door/` | The core risk in my test plan: the public API and the storefront must give the same verdict for the same name. |

**Choices I can defend:**
- **Playwright + TypeScript for API and UI:** one runner, one report, traces when a UI test fails.
- **Assert rules, not data.** Suggestions and prices change, so the tests check "every result ends in .com",
  never "the first result is X".
- **Test names are stable.** Taken = `google.com` (registered since 1997). Free = a new random name every run,
  because availability is point-in-time.
- **Known bugs are kept as expected failures**, not deleted or "fixed" by changing the assertion.
- **Safety:**
  - every browser test blocks checkout, cart and payment URLs
  - the API client stops the run after 30 calls per worker
  - API tests never retry
  - API tests record no traces, because traces store request headers, including the key
- **Readiness, not sleeps.** Wix pages ignore clicks until their JavaScript is running. The storefront helper
  waits for the page's own pricing call as the "ready" signal, instead of a fixed wait.

**Not automated (yet), and why:**
- Whether the generated names are *good*: a judgement call, not a pass/fail rule.
- Price honesty: also a judgement call; see the observations in FINDINGS.md.
- Other countries: I can only run from Israel.

## Repo layout

```
src/api/domainSearchClient.ts   the two endpoints, the call budget, the auth headers
src/data/testDomains.ts         taken name, random free name, hostname rule
src/ui/blockPurchase.ts         the "never reach checkout" route guard
tests/api/                      contract, auth, and paging tests
tests/ui/                       storefront, name generator and WHOIS
tests/cross-door/               the API and the storefront agree
evidence/                       screenshots used in FINDINGS.md
```

## With another week

1. **More API coverage:** extend the API tests beyond domains; if the scope stays domains only, add more UI and API checks on search results and search options.
2. **Currencies and regions:** test how the site behaves with different currencies and regions.
3. **Deeper name generator and WHOIS tests:** more complex prompts for the name generator.
4. **Test suites:** add smoke, sanity and end-to-end suites, each with positive and negative tests.
5. **Nightly CI run:** the API tests run automatically every night.
6. **Logged-in flows:** test with my own Wix account, because some calls change for logged-in users.


## My quality strategy for Wix Domains, in 5 lines

1. **Customer first:** test what users do most on the domain pages, which is checking if a name is free and what it costs.
2. **Same answer everywhere:** all four doors use the same Domain Search service, so they must give the same answer for the same name.
3. **Run in layers:** API tests on every PR, browser tests every night, and a live check every 5 minutes that alerts on a wrong answer or price.
4. **Stable tests:** no sleeps, no forced clicks, and no data shared between tests.
5. **Clear output:** every test prints a [RESULT] block with what it expected and what it got, and every code block has a plain-English comment.

