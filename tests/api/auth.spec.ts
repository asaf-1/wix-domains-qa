import { test, expect } from '@playwright/test';
import { DomainSearchClient } from '../../src/api/domainSearchClient';
import { TAKEN_DOMAIN } from '../../src/data/testDomains';

// The docs say these calls need an account-level API key. Today they don't (FINDINGS.md #1).
// The tests assert the documented behavior and are marked as known failures.
// Result: the suite stays green, and when Wix enforces the key these tests "unexpectedly pass" and alert us.
test.describe('Authentication (documented, not enforced: FINDINGS.md #1)', () => {
  test('a call with no API key is rejected', async ({ request }) => {
    test.fail(true, 'Known issue FINDINGS.md #1: the API answers without a key');
    const res = await new DomainSearchClient(request, {}).checkAvailability(TAKEN_DOMAIN);

    expect([401, 403]).toContain(res.status());
  });

  test('a call with a fake API key is rejected', async ({ request }) => {
    test.fail(true, 'Known issue FINDINGS.md #1: the API answers with a fake key');
    const res = await new DomainSearchClient(request, { Authorization: 'not-a-real-key' }).checkAvailability(TAKEN_DOMAIN);

    expect([401, 403]).toContain(res.status());
  });
});
