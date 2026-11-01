---
name: live-change
description: Make one small, safe change to this test suite live, in front of reviewers. Takes a number from 1 to 8 (a prepared, verified change) or a free-text request. Restates it, makes the smallest edit, shows and explains the diff, runs only the affected tests, and stops before committing.
argument-hint: "[1-8, or what to change]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git status *), Bash(git diff *), Bash(npx playwright test *)
---

# Live change

**Requested:** $ARGUMENTS

- If the request is a number from 1 to 8 (for example `5` or `change 5`), do that change from the
  **Catalog** below, exactly as written there.
- Anything else is a free-text request: do it with the same steps and rules.

## Narrate everything out loud (people are watching)

This is a live demo for reviewers. They must be able to follow every move, so narration is mandatory:

- **Before every action**, write one line: **▶ Step N/8: what I'm about to do, and why.**
  For example: *"▶ Step 3/8: I'm reading suggest-domains.spec.ts to copy the style of the existing filter test."*
- **After every action**, write one line: **✔ what happened.**
  For example: *"✔ The test passed: all 10 suggestions end in .org."*
- Never edit a file or run a command without announcing it first.
- Use plain English and short sentences. If you use a technical word, explain it in a few words.
- **At the end**, before the question in step 8, write a 3-line summary:
  - **Changed:** which file, and what in one sentence
  - **Ran:** the exact command
  - **Result:** passed, failed or `x`, and what it means

## Steps

1. **Restate** the request in one sentence, and name the file(s) you will touch. If it is unclear, ask one
   short question and stop.
2. **Check the starting point:** run `git status` and mention anything already uncommitted.
3. **Read** the file(s) you will change.
4. **Make the smallest change that does the job.** Follow the patterns of this repo. Touch nothing else:
   no refactors, no renames, no new dependencies, no formatting changes elsewhere.
5. **Show the diff:** run `git diff` (for a new file, show its content). Explain every changed line in one
   plain sentence.
6. **Run only the affected tests, with `--retries=0`.** Use the command given in the catalog.
7. **Report the result plainly:** passed, failed, or expected-fail (`x`). Compare with the catalog's
   "Expect" line.
   - If something failed: show the error (expected vs. received), and say whether the test or the app is
     wrong. Point to the trace: `npx playwright show-trace <the path it printed>`.
   - Never weaken an assertion just to make a test pass. If the app is wrong, keep the failure visible:
     suggest `test.fail()` with a reason, and let the human decide.
8. **Stop.** Do not commit, push or undo on your own. Ask: "Keep it and commit, keep it uncommitted, or undo?"
   - Undo a changed file that was committed before: `git restore <file>`.
   - Undo a new file: delete it.
   - Undo an edit to a file that was never committed: reverse the edit by hand.

## Catalog (each one verified on 2026-11-01)

### 1. A test that the `.org` filter works (API, easy)
- **File:** `tests/api/suggest-domains.spec.ts`. Add right after the test "every suggestion respects the tlds filter":
```ts
  test('every suggestion respects the tlds filter: org only', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', tlds: ['org'], 'paging.limit': 10 });

    expect(res.status()).toBe(200);
    const domains: string[] = (await res.json()).suggestions.map((s: { domain: string }) => s.domain);
    expect(domains.length).toBeGreaterThan(0);
    for (const d of domains) expect(d).toMatch(/\.org$/);
  });
```
- **Run:** `npx playwright test -g "org only" --retries=0`
- **Expect:** 1 passed.

### 2. A WHOIS test for wix.com (easy)
- **File:** `tests/ui/whois.spec.ts`. Add inside the `WHOIS lookup` describe block. The file's `beforeEach`
  already blocks purchases.
```ts
  test('wix.com shows its WHOIS record', async ({ page }) => {
    await page.goto('https://www.wix.com/domain/result/whois?query=wix.com');

    await expect(page.getByText('wix.com is registered')).toBeVisible();
  });
```
- No date check: wix.com's creation date wasn't verified, so it isn't asserted.
- **Run:** `npx playwright test -g "wix.com shows" --retries=0`
- **Expect:** 1 passed.

### 3. A different business description (Name Generator, easy)
- **File:** `tests/ui/business-name-generator.spec.ts`. Change only the `DESCRIPTION` line to:
```ts
const DESCRIPTION = 'small coffee shop in haifa';
```
- **Run:** `npx playwright test tests/ui/business-name-generator.spec.ts --retries=0`
- **Expect:** 1 passed. The AI names differ every run, and the test reads them from the response.

### 4. A `.gov` case in the cross-door test (medium)
- **File:** `tests/cross-door/availability-consistency.spec.ts`. Add at the end of the file, after the `for` loop:
```ts
test('public API and storefront agree that .gov is not for sale', async ({ request, page, context }) => {
  await blockPurchaseFlow(context);
  const res = await new DomainSearchClient(request).checkAvailability('wixqahw.gov');
  expect(res.status()).toBe(400);
  expect((await res.json()).details.applicationError.code).toBe('DOMAINS_UNSUPPORTED_TLD');

  await page.goto('https://www.wix.com/domain/result/?q=wixqahw.gov');
  // The page uses a curly apostrophe (aren’t), so match with a regex.
  await expect(page.getByText(/\.gov domains aren.t available/).first()).toBeVisible();
});
```
- **Run:** `npx playwright test -g "not for sale" --retries=0`
- **Expect:** 1 passed.

### 5. Run the browser tests on a phone (medium)
- **File:** `playwright.config.ts`. Add a project after `ui`:
```ts
    {
      name: 'ui-mobile',
      testMatch: ['ui/**/*.spec.ts', 'cross-door/**/*.spec.ts'],
      timeout: 60_000,
      // Pixel 7 runs on Chromium. iPhone devices use WebKit, which isn't installed here.
      use: { ...devices['Pixel 7'], locale: 'en-US', trace: 'retain-on-failure' },
    },
```
- **Run:** `npx playwright test --project=ui-mobile --retries=0`
- **Expect: 5 passed, 2 failed.** Both failures are real mobile differences, so explain them; don't hide them:
  1. **Name Generator:** on a phone, the page asks the AI for **6 names, not 9** (`count: 6` in the
     request). The test assumes 9: that's the test's assumption, not a bug. A good fix is to compare with
     the `count` the page sent.
  2. **WHOIS "registered domain":** the phone layout has **no "google.com is registered" headline**. The
     record itself ("Created September 15, 1997") is there. That's a real mobile difference, worth
     reporting as an observation.
- Don't fix either one on your own. Explain, then ask what to do.

### 6. Break a test and show how to debug (always works)
- **File:** `tests/ui/storefront-search.spec.ts`. Change `'Available now!'` to `'Available NOW'`.
- **Run:** `npx playwright test tests/ui/storefront-search.spec.ts --retries=0`
- **Expect:** 1 failed, 1 passed. Show the error (it expected "Available NOW" and didn't find it), then give
  the trace command it printed: `npx playwright show-trace <path>`.
- Then suggest undoing it: `git restore tests/ui/storefront-search.spec.ts`.

### 7. Turn finding #2 into a test (hard)
- **New file:** `tests/ui/pricing-fallback.spec.ts`
```ts
import { test, expect } from '@playwright/test';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

// FINDINGS.md #2: if the pricing call fails, the TLD cards fall back to static USD prices.
test('if the pricing call fails, the .com card shows no dollar price', async ({ page, context }) => {
  test.fail(true, 'Known issue FINDINGS.md #2: the page falls back to static USD prices');
  await blockPurchaseFlow(context);
  await context.route(/display-prices/, (route) => route.abort());
  await page.goto('https://www.wix.com/domains');

  // The cards load lazily, so scroll down first.
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 700);
  await page.getByText('The original domain extension').first().scrollIntoViewIfNeeded();

  // Run from Israel, prices must be in ₪. A "$" price means the static fallback.
  await expect(page.getByText(/^\$\d/).first()).toBeHidden();
});
```
- **Run:** `npx playwright test tests/ui/pricing-fallback.spec.ts --retries=0`
- **Expect:** shown as `x` and counted as "1 passed": it's expected to fail, because the bug exists.
- Without the `route(...)` line, the same check passes. That was verified, and it proves the test really
  detects the bug.
- Caveat: it assumes a run from Israel. From the US, the normal prices are in $ too.

### 8. Run in Firefox (needs a download first)
- Say first: Firefox isn't installed, and installing it takes about a minute.
- **Run:** `npx playwright install firefox`
- **File:** `playwright.config.ts`. Add a project, same as `ui` but with `devices['Desktop Firefox']`, named `ui-firefox`.
- **Run:** `npx playwright test --project=ui-firefox --retries=0`
- **Expect:** not verified in advance. Report the result honestly. If something fails, use the trace.

## Hard rules (same as CLAUDE.md)

- Never complete a purchase. Every browser test calls `blockPurchaseFlow(context)`, directly or in a `beforeEach`.
- API calls are budgeted. Go through `DomainSearchClient`, never loop over many domains, and never add retries.
- Never read or print `.env`.

## Repo facts, for free-text requests

- **API input:** a domain must include its TLD; TLD filters have no dot (`com`, not `.com`); arrays become
  repeated parameters through the client.
- **Test data:** taken = `TAKEN_DOMAIN` (`google.com`), free = `randomFreeDomain()`. Never put a random value
  in a test title, because Playwright lists tests in several processes and the titles must match.
- **Assert rules, not data:** read suggestions, prices and AI names from the response, then check the screen.
- **Storefront page:** it ignores clicks until its code runs, so reuse `searchFromStorefront()`. For the other
  doors, open the results URL directly: `/domain/result/?q=`, `/domain/result/whois?query=`, `/domain/result/bng?query=`.
- **Hidden duplicates:** use `.filter({ visible: true }).first()`.
- **WHOIS dates** depend on the browser's timezone, so keep `test.use({ timezoneId: 'UTC' })`.
- **Browsers:** only Chromium is installed. iPhone devices need WebKit; use `Pixel 7` for a phone instead.
- **Git Bash:** a `!` inside double quotes breaks the command. Use `%21`.
