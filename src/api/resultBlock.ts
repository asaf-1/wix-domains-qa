// Playwright's test tools, and the types for a response and for "info about the running test".
import { test, type APIResponse, type TestInfo } from '@playwright/test';

// Every test prints one [RESULT] block when it ends, passed or failed: what it expected,
// each API call it made and what came back, the values it checked, and the page it ended on.
// It uses only values the test already has (no extra calls or page reads), and it never prints
// headers, because they hold the API key.

// One API call, ready to print.
type Call = { request: string; key: string; http: number; answer: string[] };

// What the running test has recorded so far. Each worker runs one test at a time.
let testId = '';
let expectedText = '-';
let calls: Call[] = [];
let facts: string[] = [];

// Starts a fresh record when a new test begins.
function startIfNewTest(): void {
  const id = test.info().testId;
  if (id === testId) return;
  testId = id;
  expectedText = '-';
  calls = [];
  facts = [];
}

// The test says what it checks, in a few words. It's printed as "expected".
export function expected(text: string): void {
  startIfNewTest();
  expectedText = text;
}

// The test adds a value it checked, like the first suggestion. A list prints one item per line.
export function fact(label: string, value: unknown): void {
  startIfNewTest();
  if (Array.isArray(value)) facts.push(row(label, value.length ? '' : '-'), ...value.map((item) => `  ${item}`));
  else facts.push(row(label, value));
}

// The API client calls this after every call.
export async function recordCall(url: URL, res: APIResponse, headers: Record<string, string>): Promise<void> {
  startIfNewTest();
  // The parameters as plain text. Long values, like a paging cursor, are cut short.
  const params = [...url.searchParams].map(([key, value]) => `${key}=${shorten(value, 30)}`).join('&');
  calls.push({
    request: `GET ${url.pathname.split('/').pop()}?${params}`,
    key: keyLabel(headers),
    http: res.status(),
    answer: answerLines(await res.text()),
  });
}

// Each test file calls this in afterEach, so every test prints its own block.
// Browser tests also pass the address the page ended on.
export function printResultBlock(testInfo: TestInfo, pageUrl?: string): void {
  // A skipped test (no key in .env) made no calls, so there is nothing to show.
  if (testInfo.status === 'skipped') return;
  // Only what this test recorded. A test that failed early may have nothing yet.
  const mine = testId === testInfo.testId;
  const testCalls = mine ? calls : [];
  const testFacts = mine ? facts : [];
  const lines = [
    `  ${row('test', testInfo.title)}`,
    `  ${row('status', statusText(testInfo))}`,
    `  ${row('expected', mine ? expectedText : '-')}`,
  ];
  // An API test that failed before its first call has no request to show.
  if (testCalls.length === 0 && pageUrl === undefined) lines.push(`  ${row('request', '-')}`);
  // One call: its lines go straight into the block. Several: numbered "call 1", "call 2", and so on.
  if (testCalls.length === 1) lines.push(...callLines(testCalls[0]).map((line) => `  ${line}`));
  if (testCalls.length > 1) {
    testCalls.forEach((call, i) => lines.push(`  call ${i + 1}`, ...callLines(call).map((line) => `    ${line}`)));
  }
  // The values the test added, then the page it ended on.
  lines.push(...testFacts.map((line) => `  ${line}`));
  if (pageUrl !== undefined) lines.push(`  ${row('page', pageUrl)}`);
  // A 42-character line on top with [RESULT] in the middle, and a plain one at the bottom.
  const top = `${'='.repeat(16)} [RESULT] ${'='.repeat(16)}`;
  const bottom = '='.repeat(42);
  // Blank lines above and below, so the block stands out. One console.log keeps it in one piece.
  console.log(['', top, ...lines, bottom, ''].join('\n'));
}

// PASSED or FAILED. For a known bug (test.fail), it also says the failure is expected, and which bug.
function statusText(testInfo: TestInfo): string {
  const status = (testInfo.status ?? 'unknown').toUpperCase();
  if (testInfo.expectedStatus !== 'failed') return status;
  const bug = testInfo.annotations.find((a) => a.type === 'fail')?.description?.match(/#\d+/)?.[0];
  const note = testInfo.status === 'failed' ? 'expected' : 'expected to fail';
  return `${status} (${note}${bug ? `, bug ${bug}` : ''})`;
}

// What was sent, then the answer.
function callLines(call: Call): string[] {
  return [row('request', call.request), row('key', call.key), row('http', call.http), ...call.answer];
}

// The parts of the answer the tests look at, one per line.
function answerLines(text: string): string[] {
  const body = parseJson(text);
  if (body === undefined) return [row('body', shorten(text, 120) || '-')];
  // Check Domain Availability
  if (body.availability) {
    const { domain, available, premium } = body.availability;
    return [row('domain', domain), row('available', available), row('premium', premium)];
  }
  // Suggest Domains: at most 10 names, one per line.
  if (body.suggestions) {
    const domains: string[] = body.suggestions.map((s: { domain: string }) => s.domain);
    const more = domains.length > 10 ? [`  + ${domains.length - 10} more`] : [];
    return [
      row('count', domains.length),
      row('hasNext', body.pagingMetadata?.hasNext ?? '-'),
      row('domains', domains.length ? '' : '-'),
      ...domains.slice(0, 10).map((domain) => `  ${domain}`),
      ...more,
    ];
  }
  // An error: the message and the code ("-" when there is no code).
  return [row('message', body.message ?? '-'), row('code', body.details?.applicationError?.code ?? '-')];
}

// The answer as JSON, or undefined when it isn't JSON.
function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Says which key was sent, without printing it.
function keyLabel(headers: Record<string, string>): string {
  if (!headers.Authorization) return 'none';
  return headers.Authorization === process.env.WIX_API_KEY ? 'from .env' : 'fake';
}

// "label     : value", with the labels lined up.
function row(label: string, value: unknown): string {
  return `${label.padEnd(10)}: ${value}`.trimEnd();
}

// Cuts a long value and adds "…".
function shorten(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
