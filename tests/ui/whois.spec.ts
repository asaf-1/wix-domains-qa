import { test, expect } from '@playwright/test';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

// This page shows dates in the viewer's timezone (see the observations in FINDINGS.md).
// Pin UTC, the timezone registries use, so the expected date is the same on every machine.
test.use({ timezoneId: 'UTC' });

test.beforeEach(async ({ context }) => {
  await blockPurchaseFlow(context);
});

// These tests open the results page that the WHOIS search box leads to (see ARCHITECTURE.md).
test.describe('WHOIS lookup', () => {
  test('a registered domain shows its WHOIS record', async ({ page }) => {
    const parsed = page.waitForResponse((r) => r.url().includes('/structured-domain-info/parse-rdap'));
    await page.goto(`https://www.wix.com/domain/result/whois?query=${TAKEN_DOMAIN}`);
    const { domainInfo } = (await (await parsed).json()).info;

    await expect(page.getByText(`${TAKEN_DOMAIN} is registered`)).toBeVisible();
    // The screen must show the creation date from the public RDAP record: 1997-09-15 for google.com.
    expect(domainInfo.created).toMatch(/^1997-09-15/);
    await expect(page.getByText('September 15, 1997')).toBeVisible();
  });

  test('a free name has no WHOIS record, so it leads to the buy page', async ({ page }) => {
    await page.goto(`https://www.wix.com/domain/result/whois?query=${randomFreeDomain()}`);

    await expect(page).toHaveURL(/\/domain\/result\/\?q=/);
    await expect(page.getByText('Available now!')).toBeVisible();
  });
});
