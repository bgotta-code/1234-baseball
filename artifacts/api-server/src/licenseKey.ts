import { randomBytes } from 'node:crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

function randomSegment(len: number): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}

/** Generates a human-readable license key like ABCD-EFGH-JKLM */
export function generateLicenseKey(): string {
  return `${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}
