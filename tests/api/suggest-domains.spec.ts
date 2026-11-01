// Playwright's test tools, our API client, and the "valid domain name" rule.
import { test, expect } from '@playwright/test';
import { DomainSearchClient, hasApiKey } from '../../src/api/domainSearchClient';
import { HOSTNAME } from '../../src/data/testDomains';

// Without a key in .env, every test in this file is skipped with this message.
test.skip(!hasApiKey(), 'Set WIX_API_KEY and WIX_ACCOUNT_ID in .env to run API tests');

// Suggestions are generated and change between calls, so these tests check rules, never exact names.
test.describe('Suggest Domains', () => {
  // Ask for 5 ideas: get between 1 and 5 valid domain names, with a matching count.
  test('returns at most paging.limit valid domains, with matching paging metadata', async ({ request }) => {
    // Ask for ideas for "bakery", at most 5.
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', 'paging.limit': 5 });

    // The call worked, and between 1 and 5 ideas came back.
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions.length).toBeLessThanOrEqual(5);
    // The count in the paging info matches the number of ideas.
    expect(body.pagingMetadata.count).toBe(body.suggestions.length);
    // Every idea is a valid domain name, and "premium" is true or false.
    for (const s of body.suggestions) {
      expect(s.domain).toMatch(HOSTNAME);
      expect(typeof s.premium).toBe('boolean');
    }
  });

  // Ask for .com and .net only: every idea must end in one of them.
  test('every suggestion respects the tlds filter', async ({ request }) => {
    // Ask for up to 10 "bakery" ideas, only .com and .net.
    const res = await new DomainSearchClient(request).suggestDomains({
      query: 'bakery', tlds: ['com', 'net'], 'paging.limit': 10,
    });

    // The call worked. Take just the domain names from the answer.
    expect(res.status()).toBe(200);
    const domains: string[] = (await res.json()).suggestions.map((s: { domain: string }) => s.domain);
    // At least one idea came back, and every one ends in .com or .net.
    expect(domains.length).toBeGreaterThan(0);
    for (const d of domains) expect(d).toMatch(/\.(com|net)$/);
  });

  // Ask for names of at most 6 characters: the part before the dot must be 6 or shorter.
  test('every suggestion respects maxLength (name before the TLD)', async ({ request }) => {
    // Ask for up to 10 "bakery" ideas, with names of at most 6 characters.
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', maxLength: 6, 'paging.limit': 10 });

    // The call worked, and each name (the part before the first dot) is 6 characters or shorter.
    expect(res.status()).toBe(200);
    for (const s of (await res.json()).suggestions) {
      expect(s.domain.split('.')[0].length).toBeLessThanOrEqual(6);
    }
  });

  // The docs say to write TLDs without a dot ("com"). ".com" must be refused with a clear error.
  test('a TLD written with a dot is rejected with INVALID_TLD_FORMAT', async ({ request }) => {
    // Send the TLD as ".com", with a dot.
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', tlds: '.com' });

    // Refused (400) with the documented error INVALID_TLD_FORMAT.
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('INVALID_TLD_FORMAT');
  });

  // Asking for .gov, which Wix doesn't sell, must be refused with a clear error.
  test('a TLD Wix does not sell is rejected with TLD_NOT_SUPPORTED', async ({ request }) => {
    // Ask for .gov ideas only.
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', tlds: 'gov' });

    // Refused (400) with the documented error TLD_NOT_SUPPORTED.
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('TLD_NOT_SUPPORTED');
  });

  // Page size limits: 1 and 50 are accepted, 0 and 51 are refused.
  // (The docs say 0 is allowed; see FINDINGS.md #3.)
  test('paging.limit: 1 and 50 are accepted, 0 and 51 are rejected', async ({ request }) => {
    // One client for all four calls.
    const client = new DomainSearchClient(request);
    // Try each page size, and check the status code the API returns for it.
    for (const [limit, status] of [[1, 200], [50, 200], [0, 400], [51, 400]]) {
      const res = await client.suggestDomains({ query: 'bakery', 'paging.limit': limit });
      expect(res.status(), `paging.limit=${limit}`).toBe(status);
    }
  });

  // Get page 1, then page 2 with the "next" cursor: page 2 must not repeat a name from page 1.
  // Uses a two-word query: the single-word queries I tried returned no next page (FINDINGS.md #5).
  test('the next page has no duplicates of the first page', async ({ request }) => {
    // One client for both pages.
    const client = new DomainSearchClient(request);
    // Page 1: 5 ideas for "my bakery". It must say there is a next page.
    const first = await (await client.suggestDomains({ query: 'my bakery', 'paging.limit': 5 })).json();
    expect(first.pagingMetadata.hasNext, 'this query should have a second page').toBe(true);

    // Page 2: the same search, plus the "next" cursor that page 1 gave us.
    const second = await (await client.suggestDomains({
      query: 'my bakery', 'paging.limit': 5, 'paging.cursor': first.pagingMetadata.cursors.next,
    })).json();

    // The names from page 1, to compare against.
    const firstDomains = first.suggestions.map((s: { domain: string }) => s.domain);
    // Page 2 has ideas, and none of them was already on page 1.
    expect(second.suggestions.length).toBeGreaterThan(0);
    for (const s of second.suggestions) expect(firstDomains).not.toContain(s.domain);
  });

  // If a bigger page has more results, the smaller page should say "there's more" (hasNext: true).
  test('hasNext is true when more suggestions exist', async ({ request }) => {
    // Mark it as a known bug: hasNext says false, so this test is expected to fail.
    test.fail(true, 'Known issue FINDINGS.md #5: hasNext is false although a bigger page has more results');
    // One client for both calls.
    const client = new DomainSearchClient(request);
    // Ask for "coffee" twice: a page of 5 and a page of 20.
    const small = await (await client.suggestDomains({ query: 'coffee', 'paging.limit': 5 })).json();
    const big = await (await client.suggestDomains({ query: 'coffee', 'paging.limit': 20 })).json();
    // The page of 20 has more ideas, so more results really exist.
    expect(big.suggestions.length).toBeGreaterThan(small.suggestions.length);

    // So the page of 5 should say there's a next page.
    expect(small.pagingMetadata.hasNext).toBe(true);
  });

  // The name generator shows suggestions without re-checking them, so "suggested" must mean "available".
  test('suggested domains are really available (cross-check with Check Availability)', async ({ request }) => {
    // One client for all the calls.
    const client = new DomainSearchClient(request);
    // Get 2 ideas for "bakery".
    const { suggestions } = await (await client.suggestDomains({ query: 'bakery', 'paging.limit': 2 })).json();
    expect(suggestions.length).toBeGreaterThan(0);

    // Check each idea with Check Availability: it must really be free.
    for (const { domain } of suggestions) {
      const { availability } = await (await client.checkAvailability(domain)).json();
      expect(availability.available, `${domain} was suggested but is not available`).toBe(true);
    }
  });
});
