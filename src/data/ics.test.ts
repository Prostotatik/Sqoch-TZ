import { describe, expect, it } from 'vitest';
import { buildIcs, foldLine } from './ics';

const order = {
  orderId: 'NW-27-04817',
  email: 'ivan@example.com',
  tickets: [
    { code: 'A', holder: 'Иван', age: 35, type: 'full' as const },
    { code: 'B', holder: 'Маша', age: 9, type: 'child' as const },
  ],
};

describe('calendar export (.ics)', () => {
  const ics = buildIcs(order, new Date('2027-01-02T03:04:05Z'));

  it('is a single all-day event over both festival days', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270710');
    // DTEND is exclusive: the day after 11 July
    expect(ics).toContain('DTEND;VALUE=DATE:20270712');
    expect(ics).toContain('DTSTAMP:20270102T030405Z');
    expect(ics).toContain('UID:NW-27-04817@neon-waves.example');
  });

  it('escapes commas and uses CRLF only', () => {
    expect(ics).toContain('LOCATION:Green Arena\\, Москва');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('folds lines at 75 octets (UTF-8)', () => {
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    const long = 'DESCRIPTION:' + 'ы'.repeat(80);
    const folded = foldLine(long);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
