# Rules for AI agents in this repo

This is a QA home assignment for Wix Domains. A human owns and reviews every line.

## Hard rules (from the assignment)
- Never complete a purchase. Browsing and searching are fine; stop before checkout.
  UI tests must not click buy, cart or checkout buttons.
- No load testing, brute force or scraping. The whole assignment may use only a few
  hundred API calls: no retries on API tests, no loops over many domains.
- Test public pages and our own Wix account only.
- Never read, print or commit `.env` or the API key. Never commit network captures
  (HAR files, "Copy as cURL" output); they contain cookies.

## How tests are written here
- Suggestions and prices change between calls and by location. Assert rules
  ("every result ends in .com"), not exact lists or prices.
- Taken names: famous domains (google.com). Free names: a random label per run.
- Don't invent endpoints, fields or selectors. Use what was seen in the browser,
  the API docs, or ask.
- Prefer getByRole / getByText over CSS classes; Wix runs A/B tests.

## How to work
- Small diffs, and explain every change.
- Commit after each step with a clear message. Never squash or rewrite history.
