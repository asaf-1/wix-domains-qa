// Playwright's test tools, the test domain names, and the purchase blocker.
import { test, expect, type Page } from '@playwright/test';
import { TAKEN_DOMAIN, randomFreeDomain } from '../../src/data/testDomains';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';
// The [RESULT] block printed at the end of each test.
import { expected, fact, printResultBlock } from '../../src/api/resultBlock';

// Before every test: block checkout, cart and payment pages (safety net).
test.beforeEach(async ({ context }) => {
  await blockPurchaseFlow(context);
});

// When each test ends, print its [RESULT] block: what it expected, the values it checked, and the page.
test.afterEach(({ page }, testInfo) => printResultBlock(testInfo, page.url()));

// Search from the storefront's main search box, the way a visitor does.
// Returns the two backend answers the results page is built from (see ARCHITECTURE.md),
// so each test can check that the screen matches what the backend said.
async function searchFromStorefront(page: Page, term: string) {
  // The HTML arrives before the page's code is running, and a click that early does nothing.
  // The page's code calls display-prices as soon as it starts, so that call means "ready".
  const pageCodeRunning = page.waitForResponse((r) => r.url().includes('/display-prices'));
  // Open the storefront, then wait until its code is running.
  await page.goto('https://www.wix.com/domains');
  await pageCodeRunning;

  // Start listening for the two answers the results page is built from, before searching.
  const availability = page.waitForResponse((r) => r.url().includes('/domain-search/v2/check-domain-availability'));
  const suggestions = page.waitForResponse((r) => r.url().includes('/domain-search/v2/suggest-domains'));

  // Type the name, click Search Domains, and check that the results page opened.
  await page.getByRole('searchbox', { name: 'Type the domain you want' }).first().fill(term);
  await page.getByRole('button', { name: 'Search Domains' }).first().click();
  await expect(page).toHaveURL(/\/domain\/result\/\?q=/);

  // Hand both backend answers back to the test.
  return { availability: await availability, suggestions: await suggestions };
}

// The storefront tests: a taken name and a free name.
test.describe('Domain storefront search', () => {
  // google.com: shown as taken, with other names to choose from.
  test('a registered domain is shown as taken, with alternatives', async ({ page }) => {
    expected(`server says available: false, page shows "${TAKEN_DOMAIN} is already registered" and the first suggestion`);
    fact('search', TAKEN_DOMAIN);
    // Search for google.com from the storefront.
    const { availability, suggestions } = await searchFromStorefront(page, TAKEN_DOMAIN);

    // The backend said "taken", and the screen says "google.com is already registered".
    const { available } = (await availability.json()).availability;
    fact('available', available);
    expect(available).toBe(false);
    await expect(page.getByText(`${TAKEN_DOMAIN} is already registered`)).toBeVisible();

    // Suggestions are generated, so take the first one from the response instead of hard-coding it.
    const firstAlternative = (await suggestions.json()).suggestions[0].domain;
    fact('suggestion', firstAlternative);
    // That first suggestion is visible on screen.
    await expect(page.getByText(firstAlternative, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  // A brand-new random name: shown as available, with a yearly price.
  test('a new name is shown as available, with a yearly price', async ({ page }) => {
    expected('server says available: true, page shows "Available now!", the name, and a price ending in /yr');
    // Make a new random name, and search for it from the storefront.
    const domain = randomFreeDomain();
    fact('search', domain);
    const { availability } = await searchFromStorefront(page, domain);

    // The backend said "free", and the screen says "Available now!" and shows the name.
    const { available } = (await availability.json()).availability;
    fact('available', available);
    expect(available).toBe(true);
    await expect(page.getByText('Available now!')).toBeVisible();
    await expect(page.getByText(domain, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    // Price and currency depend on location (₪ from Israel), so check the format, not the amount.
    await expect(page.getByText(/\d+\.\d{2}\/yr$/).first()).toBeVisible();
  });
});
