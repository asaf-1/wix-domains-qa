import { test, expect } from '@playwright/test';
import { DomainSearchClient, hasApiKey } from '../../src/api/domainSearchClient';
import { HOSTNAME } from '../../src/data/testDomains';

test.skip(!hasApiKey(), 'Set WIX_API_KEY and WIX_ACCOUNT_ID in .env to run API tests');

// Suggestions are generated and change between calls, so these tests check rules, never exact names.
test.describe('Suggest Domains', () => {
  test('returns at most paging.limit valid domains, with matching paging metadata', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', 'paging.limit': 5 });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions.length).toBeLessThanOrEqual(5);
    expect(body.pagingMetadata.count).toBe(body.suggestions.length);
    for (const s of body.suggestions) {
      expect(s.domain).toMatch(HOSTNAME);
      expect(typeof s.premium).toBe('boolean');
    }
  });

  test('every suggestion respects the tlds filter', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({
      query: 'bakery', tlds: ['com', 'net'], 'paging.limit': 10,
    });

    expect(res.status()).toBe(200);
    const domains: string[] = (await res.json()).suggestions.map((s: { domain: string }) => s.domain);
    expect(domains.length).toBeGreaterThan(0);
    for (const d of domains) expect(d).toMatch(/\.(com|net)$/);
  });

  test('every suggestion respects maxLength (name before the TLD)', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', maxLength: 6, 'paging.limit': 10 });

    expect(res.status()).toBe(200);
    for (const s of (await res.json()).suggestions) {
      expect(s.domain.split('.')[0].length).toBeLessThanOrEqual(6);
    }
  });

  test('a TLD written with a dot is rejected with INVALID_TLD_FORMAT', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', tlds: '.com' });

    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('INVALID_TLD_FORMAT');
  });

  test('a TLD Wix does not sell is rejected with TLD_NOT_SUPPORTED', async ({ request }) => {
    const res = await new DomainSearchClient(request).suggestDomains({ query: 'bakery', tlds: 'gov' });

    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('TLD_NOT_SUPPORTED');
  });

  test('paging.limit: 1 and 50 are accepted, 0 and 51 are rejected', async ({ request }) => {
    const client = new DomainSearchClient(request);
    for (const [limit, status] of [[1, 200], [50, 200], [0, 400], [51, 400]]) {
      const res = await client.suggestDomains({ query: 'bakery', 'paging.limit': limit });
      expect(res.status(), `paging.limit=${limit}`).toBe(status);
    }
  });

  // Uses a two-word query: the single-word queries I tried returned no next page (FINDINGS.md #5).
  test('the next page has no duplicates of the first page', async ({ request }) => {
    const client = new DomainSearchClient(request);
    const first = await (await client.suggestDomains({ query: 'my bakery', 'paging.limit': 5 })).json();
    expect(first.pagingMetadata.hasNext, 'this query should have a second page').toBe(true);

    const second = await (await client.suggestDomains({
      query: 'my bakery', 'paging.limit': 5, 'paging.cursor': first.pagingMetadata.cursors.next,
    })).json();

    const firstDomains = first.suggestions.map((s: { domain: string }) => s.domain);
    expect(second.suggestions.length).toBeGreaterThan(0);
    for (const s of second.suggestions) expect(firstDomains).not.toContain(s.domain);
  });

  test('hasNext is true when more suggestions exist', async ({ request }) => {
    test.fail(true, 'Known issue FINDINGS.md #5: hasNext is false although a bigger page has more results');
    const client = new DomainSearchClient(request);
    const small = await (await client.suggestDomains({ query: 'coffee', 'paging.limit': 5 })).json();
    const big = await (await client.suggestDomains({ query: 'coffee', 'paging.limit': 20 })).json();
    expect(big.suggestions.length).toBeGreaterThan(small.suggestions.length);

    expect(small.pagingMetadata.hasNext).toBe(true);
  });

  // The name generator shows suggestions without re-checking them, so "suggested" must mean "available".
  test('suggested domains are really available (cross-check with Check Availability)', async ({ request }) => {
    const client = new DomainSearchClient(request);
    const { suggestions } = await (await client.suggestDomains({ query: 'bakery', 'paging.limit': 2 })).json();
    expect(suggestions.length).toBeGreaterThan(0);

    for (const { domain } of suggestions) {
      const { availability } = await (await client.checkAvailability(domain)).json();
      expect(availability.available, `${domain} was suggested but is not available`).toBe(true);
    }
  });
});
