// Playwright's type for a browser session (all the tabs of one test).
import type { BrowserContext } from '@playwright/test';

// Safety net for the assignment rule "never complete a purchase":
// any request to a checkout, cart or payment URL is aborted, even if a test clicks the wrong button.
export async function blockPurchaseFlow(context: BrowserContext): Promise<void> {
  // Any URL with "checkout", "/cart" or "payment" in it is cancelled before it loads.
  await context.route(/checkout|\/cart|payment/i, (route) => route.abort());
}
