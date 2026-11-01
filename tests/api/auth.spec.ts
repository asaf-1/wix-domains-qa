// Playwright's test tools, our API client, and the taken test name.
import { test, expect } from '@playwright/test';
import { DomainSearchClient } from '../../src/api/domainSearchClient';
import { TAKEN_DOMAIN } from '../../src/data/testDomains';

// The docs say these calls need an account-level API key. Today they don't (FINDINGS.md #1).
// The tests assert the documented behavior and are marked as known failures.
// Result: the suite stays green, and when Wix enforces the key these tests "unexpectedly pass" and alert us.
test.describe('Authentication (documented, not enforced: FINDINGS.md #1)', () => {
  // No key at all: the API should refuse the call.
  test('a call with no API key is rejected', async ({ request }) => {
    // Mark it as a known bug: today the API answers anyway, so this test is expected to fail.
    test.fail(true, 'Known issue FINDINGS.md #1: the API answers without a key');
    // Call the API with no headers at all: no key and no account ID.
    const res = await new DomainSearchClient(request, {}).checkAvailability(TAKEN_DOMAIN);

    // What the docs promise: refused, with 401 or 403.
    expect([401, 403]).toContain(res.status());
  });

  // A made-up key: the API should refuse it too.
  test('a call with a fake API key is rejected', async ({ request }) => {
    // Mark it as a known bug: today the API accepts a fake key, so this test is expected to fail.
    test.fail(true, 'Known issue FINDINGS.md #1: the API answers with a fake key');
    // Call the API with a fake key.
    const res = await new DomainSearchClient(request, { Authorization: 'not-a-real-key' }).checkAvailability(TAKEN_DOMAIN);

    // What the docs promise: refused, with 401 or 403.
    expect([401, 403]).toContain(res.status());
  });
});
