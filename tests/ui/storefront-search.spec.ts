import { test, expect, type Page } from '@playwright/test';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

test.beforeEach(async ({ context }) => {
  await blockPurchaseFlow(context);
});

// Search from the storefront's main search box, the way a visitor does.
// Returns the two backend answers the results page is built from (see ARCHITECTURE.md),
// so each test can check that the screen matches what the backend said.
// to-do: add a test that the "Search Domains" button actually works, and that the page shows the new results.
async function searchFromStorefront(page: Page, term: string) {
  // The HTML arrives before the page's code is running, and a click that early does nothing.
  // The page's code calls display-prices as soon as it starts, so that call means "ready".
  const pageCodeRunning = page.waitForResponse((r) => r.url().includes('/display-prices'));
  await page.goto('https://www.wix.com/domains');
  await pageCodeRunning;

  const availability = page.waitForResponse((r) => r.url().includes('/domain-search/v2/check-domain-availability'));
  const suggestions = page.waitForResponse((r) => r.url().includes('/domain-search/v2/suggest-domains'));

  await page.getByRole('searchbox', { name: 'Type the domain you want' }).first().fill(term);
  await page.getByRole('button', { name: 'Search Domains' }).first().click();
  await expect(page).toHaveURL(/\/domain\/result\/\?q=/);

  return { availability: await availability, suggestions: await suggestions };
}

test.describe('Domain storefront search', () => {
  test('a registered domain is shown as taken, with alternatives', async ({ page }) => {
    const { availability, suggestions } = await searchFromStorefront(page, TAKEN_DOMAIN);

    expect((await availability.json()).availability.available).toBe(false);
    await expect(page.getByText(`${TAKEN_DOMAIN} is already registered`)).toBeVisible();

    // Suggestions are generated, so take the first one from the response instead of hard-coding it.
    const firstAlternative = (await suggestions.json()).suggestions[0].domain;
    await expect(page.getByText(firstAlternative, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('a new name is shown as available, with a yearly price', async ({ page }) => {
    const domain = randomFreeDomain();
    const { availability } = await searchFromStorefront(page, domain);

    expect((await availability.json()).availability.available).toBe(true);
    await expect(page.getByText('Available now!')).toBeVisible();
    await expect(page.getByText(domain, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    // Price and currency depend on location (₪ from Israel), so check the format, not the amount.
    await expect(page.getByText(/\d+\.\d{2}\/yr$/).first()).toBeVisible();
  });
});
