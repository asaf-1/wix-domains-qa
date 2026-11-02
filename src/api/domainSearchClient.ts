// Playwright's types for the request tool and the response it returns.
import type { APIRequestContext, APIResponse } from '@playwright/test';
// Saves each call for the test's [RESULT] block.
import { recordCall } from './resultBlock';

// The address of the public Domain Search API. Both endpoints live under it.
export const API_BASE = 'https://www.wixapis.com/domain-search/v2';

// The assignment allows a few hundred API calls in total. One full run makes about 27.
// Every call goes through this client, so a runaway loop fails fast instead of burning the budget.
// Playwright runs each worker in its own process, so this limit is per worker.
const MAX_CALLS_PER_WORKER = 30;
// How many calls this worker has made so far.
let callCount = 0;

// The shape of the query parameters: a name and a value, or a list of values (like several TLDs).
type Params = Record<string, string | number | string[]>;

// True when .env has a key. Tests that need the key use this to skip themselves without one.
export function hasApiKey(): boolean {
  return Boolean(process.env.WIX_API_KEY);
}

// The two headers every call sends by default: the API key and the Wix account ID, read from .env.
export function keyHeaders(): Record<string, string> {
  return {
    Authorization: process.env.WIX_API_KEY ?? '',
    'wix-account-id': process.env.WIX_ACCOUNT_ID ?? '',
  };
}

// One place for all API calls: the two endpoints, the headers and the call budget.
export class DomainSearchClient {
  // Takes Playwright's request tool, and the headers to send (the real key, unless a test passes others).
  // headers can be overridden to test auth, e.g. {} for "no key".
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: Record<string, string> = keyHeaders(),
  ) {}

  // Asks "is this exact domain free?" (the Check Domain Availability endpoint).
  checkAvailability(domain: string): Promise<APIResponse> {
    return this.get('check-domain-availability', { domain });
  }

  // Asks for domain ideas for a keyword, with optional filters (the Suggest Domains endpoint).
  suggestDomains(params: Params): Promise<APIResponse> {
    return this.get('suggest-domains', params);
  }

  // Sends the request: counts the call, builds the URL, adds the headers, and saves the call for the [RESULT] block.
  private async get(path: string, params: Params): Promise<APIResponse> {
    // Count this call, and stop the run if this worker went over its budget.
    callCount += 1;
    if (callCount > MAX_CALLS_PER_WORKER) {
      throw new Error(`API call budget exceeded: more than ${MAX_CALLS_PER_WORKER} calls in one worker`);
    }
    // Build the full address: the base, then the endpoint name.
    const url = new URL(`${API_BASE}/${path}`);
    // Arrays become repeated params (tlds=com&tlds=net), which is how the API expects them.
    for (const [key, value] of Object.entries(params)) {
      for (const item of [value].flat()) url.searchParams.append(key, String(item));
    }
    // Send the GET request with the headers.
    const res = await this.request.get(url.toString(), { headers: this.headers });
    // Save what was sent and what came back, for this test's [RESULT] block.
    await recordCall(url, res, this.headers);
    // Hand the response back to the test.
    return res;
  }
}
