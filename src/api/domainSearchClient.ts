import type { APIRequestContext, APIResponse } from '@playwright/test';

export const API_BASE = 'https://www.wixapis.com/domain-search/v2';

// The assignment allows a few hundred API calls in total. One full run makes about 25.
// Every call goes through this client, so a runaway loop fails fast instead of burning the budget.
// Playwright runs each worker in its own process, so this limit is per worker.
const MAX_CALLS_PER_WORKER = 30;
let callCount = 0;

type Params = Record<string, string | number | string[]>;

export function hasApiKey(): boolean {
  return Boolean(process.env.WIX_API_KEY);
}

export function keyHeaders(): Record<string, string> {
  return {
    Authorization: process.env.WIX_API_KEY ?? '',
    'wix-account-id': process.env.WIX_ACCOUNT_ID ?? '',
  };
}

export class DomainSearchClient {
  // headers can be overridden to test auth, e.g. {} for "no key".
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: Record<string, string> = keyHeaders(),
  ) {}

  checkAvailability(domain: string): Promise<APIResponse> {
    return this.get('check-domain-availability', { domain });
  }

  suggestDomains(params: Params): Promise<APIResponse> {
    return this.get('suggest-domains', params);
  }

  private get(path: string, params: Params): Promise<APIResponse> {
    callCount += 1;
    if (callCount > MAX_CALLS_PER_WORKER) {
      throw new Error(`API call budget exceeded: more than ${MAX_CALLS_PER_WORKER} calls in one worker`);
    }
    const url = new URL(`${API_BASE}/${path}`);
    // Arrays become repeated params (tlds=com&tlds=net), which is how the API expects them.
    for (const [key, value] of Object.entries(params)) {
      for (const item of [value].flat()) url.searchParams.append(key, String(item));
    }
    return this.request.get(url.toString(), { headers: this.headers });
  }
}
