import { test, expect } from '@playwright/test';
import { blockPurchaseFlow } from '../../src/ui/blockPurchase';

const DESCRIPTION = 'small family bakery in tel aviv';

test.beforeEach(async ({ context }) => {
  await blockPurchaseFlow(context);
});

// Opens the results page that the generator's "Generate Names" button leads to (see ARCHITECTURE.md).
// The names are AI-generated and different every time, so the test reads them from the response
// and checks that the screen shows them, instead of expecting fixed names.
test.describe('Business Name Generator', () => {
  test('a business description gets 9 names, and domains for the first name', async ({ page }) => {
    const generated = page.waitForResponse((r) => r.url().includes('/business-names/generate'));
    const suggested = page.waitForResponse((r) => r.url().includes('/domain-search/v2/suggest-domains'));
    await page.goto(`https://www.wix.com/domain/result/bng?query=${encodeURIComponent(DESCRIPTION)}`);

    const { businessNames } = await (await generated).json();
    expect(businessNames).toHaveLength(9); // the page asks for 9 (count: 9 in the request)
    for (const { name } of businessNames) {
      await expect(page.getByText(name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }

    // Domains are suggested for the first (selected) name, and the first suggestion is on screen.
    const suggestResponse = await suggested;
    expect(new URL(suggestResponse.url()).searchParams.get('query')).toBe(businessNames[0].name);
    const { suggestions } = await suggestResponse.json();
    await expect(page.getByText(suggestions[0].domain, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });
});
