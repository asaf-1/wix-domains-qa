import { test, expect } from '@playwright/test';
import { DomainSearchClient, hasApiKey } from '../../src/api/domainSearchClient';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';

test.skip(!hasApiKey(), 'Set WIX_API_KEY and WIX_ACCOUNT_ID in .env to run API tests');

test.describe('Check Domain Availability', () => {
  test('a famous registered domain is not available', async ({ request }) => {
    const res = await new DomainSearchClient(request).checkAvailability(TAKEN_DOMAIN);

    expect(res.status()).toBe(200);
    const { availability } = await res.json();
    expect(availability).toMatchObject({ domain: TAKEN_DOMAIN, available: false });
  });

  test('a random new name is available, with the documented fields', async ({ request }) => {
    const domain = randomFreeDomain();
    const res = await new DomainSearchClient(request).checkAvailability(domain);

    expect(res.status()).toBe(200);
    const { availability } = await res.json();
    expect(availability.domain).toBe(domain);
    expect(availability.available).toBe(true);
    expect(typeof availability.premium).toBe('boolean');
  });

  test('uppercase input gets the same answer, with the domain in lowercase', async ({ request }) => {
    const res = await new DomainSearchClient(request).checkAvailability(TAKEN_DOMAIN.toUpperCase());

    expect(res.status()).toBe(200);
    expect((await res.json()).availability).toMatchObject({ domain: TAKEN_DOMAIN, available: false });
  });

  test('a name without a TLD is rejected with INVALID_DOMAIN', async ({ request }) => {
    const res = await new DomainSearchClient(request).checkAvailability('mybakery');

    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('INVALID_DOMAIN');
  });

  for (const bad of ['my bakery.com', 'my_bakery.com']) {
    test(`a name with an invalid character is rejected: "${bad}"`, async ({ request }) => {
      const res = await new DomainSearchClient(request).checkAvailability(bad);

      expect(res.status()).toBe(400);
    });
  }

  test('a TLD Wix does not sell is rejected, not reported as taken', async ({ request }) => {
    const res = await new DomainSearchClient(request).checkAvailability('wixqahw.gov');

    expect(res.status()).toBe(400);
    // Not in the docs (see FINDINGS.md #3), but this is the code the storefront relies on.
    expect((await res.json()).details.applicationError.code).toBe('DOMAINS_UNSUPPORTED_TLD');
  });
});
