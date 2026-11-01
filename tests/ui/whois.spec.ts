// Playwright's test tools, the test domain names, and the purchase blocker.
import { test, expect } from '@playwright/test';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

// This page shows dates in the viewer's timezone (see the observations in FINDINGS.md).
// Pin UTC, the timezone registries use, so the expected date is the same on every machine.
test.use({ timezoneId: 'UTC' });

// Before every test: block checkout, cart and payment pages (safety net).
test.beforeEach(async ({ context }) => {
  await blockPurchaseFlow(context);
});

// These tests open the results page that the WHOIS search box leads to (see ARCHITECTURE.md).
test.describe('WHOIS lookup', () => {
  // google.com: the screen says "is registered" and shows its real creation date.
  test('a registered domain shows its WHOIS record', async ({ page }) => {
    // Start listening for the parsed WHOIS record, then open the WHOIS page for google.com.
    const parsed = page.waitForResponse((r) => r.url().includes('/structured-domain-info/parse-rdap'));
    await page.goto(`https://www.wix.com/domain/result/whois?query=${TAKEN_DOMAIN}`);
    // Take the record's details out of that answer.
    const { domainInfo } = (await (await parsed).json()).info;

    // The headline says google.com is registered.
    await expect(page.getByText(`${TAKEN_DOMAIN} is registered`)).toBeVisible();
    // The screen must show the creation date from the public RDAP record: 1997-09-15 for google.com.
    expect(domainInfo.created).toMatch(/^1997-09-15/);
    await expect(page.getByText('September 15, 1997')).toBeVisible();
  });

  // A brand-new random name has no record, so the page sends the user to the buy page.
  test('a free name has no WHOIS record, so it leads to the buy page', async ({ page }) => {
    // Open the WHOIS page for a brand-new random name.
    await page.goto(`https://www.wix.com/domain/result/whois?query=${randomFreeDomain()}`);

    // The page moved to the results (buy) page, and it says "Available now!".
    await expect(page).toHaveURL(/\/domain\/result\/\?q=/);
    await expect(page.getByText('Available now!')).toBeVisible();
  });
});
