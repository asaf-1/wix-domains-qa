// Registered since 1997 and renewed until 2028, so it stays taken.
export const TAKEN_DOMAIN = 'google.com';

// Availability is a point-in-time answer, so a fixed "free" name could be registered tomorrow.
// A fresh random label per run is almost surely free.
export function randomFreeDomain(tld = 'com'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `qahw-${random}.${tld}`;
}

// Lowercase hostname: labels of 1-63 letters, digits or inner hyphens, at least one dot.
export const HOSTNAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
