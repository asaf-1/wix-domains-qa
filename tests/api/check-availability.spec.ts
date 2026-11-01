// Playwright's test tools, our API client, and the test domain names.
import { test, expect } from '@playwright/test';
import { DomainSearchClient, hasApiKey } from '../../src/api/domainSearchClient';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';

// Without a key in .env, every test in this file is skipped with this message.
test.skip(!hasApiKey(), 'Set WIX_API_KEY and WIX_ACCOUNT_ID in .env to run API tests');

// All the tests for the Check Domain Availability endpoint.
test.describe('Check Domain Availability', () => {
  // google.com must come back as taken.
  test('a famous registered domain is not available', async ({ request }) => {
    // Ask the API about google.com.
    const res = await new DomainSearchClient(request).checkAvailability(TAKEN_DOMAIN);

    // The call worked (200), and the answer is "google.com, not available".
    expect(res.status()).toBe(200);
    const { availability } = await res.json();
    expect(availability).toMatchObject({ domain: TAKEN_DOMAIN, available: false });
  });

  // A brand-new random name must come back as free, with the fields the docs promise.
  test('a random new name is available, with the documented fields', async ({ request }) => {
    // Make a new random name (like qahw-k3x9q2ab.com) and ask the API about it.
    const domain = randomFreeDomain();
    const res = await new DomainSearchClient(request).checkAvailability(domain);

    // The call worked, the same name came back, it's free, and "premium" is true or false.
    expect(res.status()).toBe(200);
    const { availability } = await res.json();
    expect(availability.domain).toBe(domain);
    expect(availability.available).toBe(true);
    expect(typeof availability.premium).toBe('boolean');
  });

  // GOOGLE.COM in capital letters must get the same answer as google.com.
  test('uppercase input gets the same answer, with the domain in lowercase', async ({ request }) => {
    // Ask the API about GOOGLE.COM.
    const res = await new DomainSearchClient(request).checkAvailability(TAKEN_DOMAIN.toUpperCase());

    // Same answer as lowercase: taken, and the name comes back as google.com.
    expect(res.status()).toBe(200);
    expect((await res.json()).availability).toMatchObject({ domain: TAKEN_DOMAIN, available: false });
  });

  // A name with no ending (no .com) must be refused.
  test('a name without a TLD is rejected with INVALID_DOMAIN', async ({ request }) => {
    // Ask the API about "mybakery", with no ending.
    const res = await new DomainSearchClient(request).checkAvailability('mybakery');

    // Refused (400) with the documented error INVALID_DOMAIN.
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('INVALID_DOMAIN');
  });

  // A space or an underscore isn't allowed in a domain name. This makes one test for each.
  for (const bad of ['my bakery.com', 'my_bakery.com']) {
    test(`a name with an invalid character is rejected: "${bad}"`, async ({ request }) => {
      // Ask the API about the bad name.
      const res = await new DomainSearchClient(request).checkAvailability(bad);

      // Refused (400).
      expect(res.status()).toBe(400);
    });
  }

  // .gov isn't sold by Wix: the API must say "not supported", not "taken".
  test('a TLD Wix does not sell is rejected, not reported as taken', async ({ request }) => {
    // Ask the API about a .gov name.
    const res = await new DomainSearchClient(request).checkAvailability('wixqahw.gov');

    // Refused (400).
    expect(res.status()).toBe(400);
    // Not in the docs (see FINDINGS.md #3), but this is the code the storefront relies on.
    expect((await res.json()).details.applicationError.code).toBe('DOMAINS_UNSUPPORTED_TLD');
  });
});
