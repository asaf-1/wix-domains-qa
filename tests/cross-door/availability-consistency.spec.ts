import { test, expect } from '@playwright/test';
import { DomainSearchClient, hasApiKey } from '../../src/api/domainSearchClient';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

test.skip(!hasApiKey(), 'Set WIX_API_KEY and WIX_ACCOUNT_ID in .env to run the cross-door test');

// The same question through two doors must get the same answer:
// the public API answers first, then the storefront results page must show the same verdict.
const cases = [
  { what: 'a registered domain', domain: TAKEN_DOMAIN },
  { what: 'a new random name', domain: randomFreeDomain() },
];

for (const { what, domain } of cases) {
  test(`public API and storefront agree on ${what}`, async ({ request, page, context }) => {
    await blockPurchaseFlow(context);
    const { availability } = await (await new DomainSearchClient(request).checkAvailability(domain)).json();

    // This is the page the storefront search box leads to (see ARCHITECTURE.md).
    await page.goto(`https://www.wix.com/domain/result/?q=${domain}`);

    const verdict = availability.available ? 'Available now!' : `${domain} is already registered`;
    await expect(page.getByText(verdict)).toBeVisible();
  });
}
