# Test Plan: "Can I get this name?"

**Goal:** every door gives the user a **correct, consistent and honest** answer to "Can I get this name,
and what will it cost?"

The plan is based on what I mapped in [ARCHITECTURE.md](ARCHITECTURE.md). All doors share one Domain Search
service, and prices come from a separate service. Most risk sits where the doors **differ**, not inside any
single door.

## 1. Scope

**In scope:**
- Domain storefront, the shared results page it leads to, Business Name Generator, WHOIS lookup
- Public Domain Search API (`check-domain-availability`, `suggest-domains`)
- An anonymous visitor (logged out), desktop Chrome, location Israel (₪)

**Out of scope, and why:**

| Left out | Why |
|---|---|
| Checkout, cart, payment | The rules forbid completing a purchase. It's also a separate flow with its own owners. |
| After purchase: DNS, transfer, connecting a domain | That answers a different question: "I own it, now what?" |
| Load and rate-limit testing | Forbidden here. It needs a staging environment and an agreement with the service owners. |
| Other countries and currencies | I can't change location reliably in 3 hours. It's the first item for next week. |
| Logged-in behavior | Some calls change for logged-in users (`user_domains`). Next week, with my own account. |
| Full accessibility audit, all browsers, native apps | Basic checks only (section 5, I). |
| Analytics, BI events, ad pixels | They don't affect the answer the user gets. |

## 2. Risks, ranked

Risk = **impact** (how bad for the user or Wix) × **likelihood** (how easily it happens, given the architecture).

| # | Risk | Impact | Likelihood, and why | Priority |
|---|---|---|---|---|
| R1 | **Wrong availability answer:** a free name shown as taken, or a taken one as free | Lost sale, or a failed registration after the user decided | Low–Med: availability is point-in-time, and the single and bulk checks are separate calls | **P0** |
| R2 | **Doors disagree** on the same name | Confusion, support tickets, partners showing wrong data | Med: the name generator trusts `suggest-domains` and never re-checks availability | **P0** |
| R3 | **Price wrong or misleading:** currency, premium, renewal | Money, trust, consumer-protection exposure | Med: there are two price sources on one page (CMS USD + live ₪), and .com renews at about 4× its first-year price | **P0** |
| R4 | **Public API differs from its docs:** auth, validation, error codes | Partner integrations break, wrong security assumptions | High: already seen during mapping | **P1** |
| R5 | **Input handling:** case, spaces, `www.`, `https://`, trailing dot, IDN, length | The user sees an error, or a different name gets checked | Med | **P1** |
| R6 | **Unsupported TLD** shown as "taken" or as an error | Lost sale, confusion | Med | **P1** |
| R7 | **Suggestions** irrelevant, unavailable, or ignoring filters | Weak conversion | Med | **P2** |
| R8 | **WHOIS** shows wrong dates, registrar or redaction | Trust | Low: it parses public RDAP | **P2** |
| R9 | **A helper service fails** (pricing, labels) and breaks the page | Lost sale | Low–Med | **P2** |
| R10 | **Mobile and accessibility** basics | Some users excluded | Med | **P3** |

## 3. Approach: which kind of test goes where

| Layer | What it covers | How | When it runs |
|---|---|---|---|
| **API contract** (automated) | Check + Suggest: happy paths, documented errors, limits, auth | Playwright `request`; assert rules, never snapshots | every PR + nightly |
| **Cross-door consistency** (automated) | The same name gets the same answer from the API and the storefront; suggestions are really available | Playwright: one API call + one UI search | nightly |
| **UI** (automated, thin) | Storefront: taken and free states, a price is shown, never reaches checkout | Playwright, role and text selectors, plus an assertion on the network call | nightly |
| **Exploratory** (manual) | Price honesty, input handling, name generator quality, WHOIS edge cases | 15-minute charters, results in [FINDINGS.md](FINDINGS.md) | each release |
| **Production monitoring** | A known taken name and a random free name, every few minutes; error rate on Domain Search and pricing | synthetic checks + alerts | always |

UI tests are kept thin on purpose. The pages are marketing sites with A/B experiments, so they change
often. The answer itself comes from the API layer, which is stable and cheap to test.

## 4. Test data

| Need | Value | Why this value |
|---|---|---|
| Taken name | `google.com` | Registered since 1997; it won't become free |
| Free name | `qahw-<random>.com`, new every run | Availability is point-in-time, and a random label is almost surely free |
| Premium name | picked at runtime from `suggest-domains` where `premium: true` | The list of premium names changes |
| Unsupported TLD | `.gov` | Wix doesn't sell it (`DOMAINS_UNSUPPORTED_TLD`) |
| IDN | `xn--mnchen-3ya.com` (münchen.com) | Punycode form of a non-English name |
| Not a domain | `My Bakery!` | Spaces and punctuation |

## 5. Checks by area

**A. Availability correctness (P0)**
- A1. `google.com` is taken at every door.
- A2. A random name is available at every door.
- A3. `GOOGLE.COM`, ` google.com `, `www.google.com`, `https://google.com/` and `google.com.` all get the
  same answer as `google.com`.
- A4. A premium name is flagged premium, and a premium price is shown.

**B. Consistency between doors (P0)**
- B1. Public API and storefront agree, for a taken name and for a free name.
- B2. Every suggested domain is really available. Send `suggest-domains` results to `check-domain-availability`.
- B3. The same domain shows the same price in the name generator and in the storefront.
- B4. WHOIS "is registered" matches storefront "is already registered".

**C. Price (P0)**
- C1. Local currency everywhere on one page, with the same price on the landing TLD card and on the results page.
- C2. The renewal price is visible before checkout. First year and renewal differ a lot: .com is ₪21.47 vs ₪90.19.
- C3. A premium domain shows its premium price, not the standard TLD price.
- C4. If the pricing call fails, the page doesn't show prices in the wrong currency. Test by blocking the call
  in the browser.

**D. Public API contract (P1)**
- D1. Response shape: types, `domain` returned in lowercase.
- D2. Documented errors: `INVALID_DOMAIN`, `INVALID_QUERY`, `INVALID_TLD_FORMAT`, `TLD_NOT_SUPPORTED`.
- D3. Limits: `paging.limit` 1 / 50 / 51 / 0, `maxLength`, at most 10 TLDs, query at most 100 characters.
- D4. Auth: with no key or a bad key, the docs imply a 401. Currently it returns 200; see FINDINGS.
- D5. Cursor paging: the next page has no duplicates of the first page.

**E. Input handling (P1)**
- Label of 63 vs 64 characters.
- Leading or trailing hyphen.
- Double dots.
- IDN (`münchen.com`).
- Empty submit.
- 100+ characters.
- HTML in the search box (`<b>qa</b>`) is shown as text, not rendered. The query is echoed back from `?q=`.

**F. Suggestions and name generator (P2)**
- Suggestions contain the keyword and respect `tlds` and `maxLength`, with no duplicates.
- Location-specific endings appear (`.co.il` from Israel).
- The generator returns 9 names. "Generate more names" doesn't repeat them.
- Offensive input is handled (AI guardrails).

**G. WHOIS (P2)**
- Dates and nameservers match the public RDAP record.
- Redaction is shown as "redacted", not as an error.
- A free name leads to the buy flow.
- A URL input (`https://www.google.com/path`) is parsed to the domain.

**H. Resilience (P2)**
- Block `suggest-domains`, the pricing call and the labels call one at a time. The availability headline must
  still show.

**I. Mobile and accessibility (P3)**
- Search works at 390 px width.
- Search works with the keyboard only.
- An axe scan of the results page shows no critical issues.

## 6. What I automate now, and what stays manual

**Automated in this repo:** D1–D3 and D5 (API contract), B1 and B2 (consistency), A1 and A2 on the storefront.
- They protect the P0 answer.
- They're stable because they assert rules, not data.
- They're cheap: about 25 API calls per run.

**Manual:** C2 and C3 (price honesty), E (input display), F (name quality), G, and the UI look.
- These need judgement, or depend on data that changes too much for a reliable assertion.

## 7. Constraints

- Production only: no staging access.
- At most a few hundred API calls in total. So: no retries, a call counter in the API client, and only one
  random name per run.
- Never click a buy button. As a safety net, UI tests also block any checkout, cart or payment URL.

## 8. Entry and exit

- **Entry:** the doors are reachable, and the API key works.
- **Exit for a release:** all P0 checks pass, there are no open P0 or P1 bugs, and P2 issues are known and accepted.
