/**
 * "Добавить в календарь" (INV-13): an RFC 5545 all-day event for the festival, generated on the client.
 * Lines are CRLF-terminated and folded at 75 octets (UTF-8 aware — Cyrillic is 2 bytes per char).
 */
import { FESTIVAL_EVENT } from './event';
import type { Confirmation } from './mockApi';

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

const encoder = new TextEncoder();

export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    // first line may hold 75 octets, continuation lines 74 (+ the leading space)
    if (bytes + len > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (iso: string) => iso.replace(/-/g, '');

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(c: Pick<Confirmation, 'orderId' | 'email' | 'tickets'>, now = new Date()): string {
  const ev = FESTIVAL_EVENT;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neon Waves//Tickets demo//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${c.orderId}@neon-waves.example`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${ymd(ev.dates.start)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(ev.dates.end))}`,
    `SUMMARY:${escapeText(`${ev.title} — музыкальный фестиваль`)}`,
    `LOCATION:${escapeText(`${ev.venue.name}, ${ev.venue.city}`)}`,
    `DESCRIPTION:${escapeText(`Заказ № ${c.orderId}. Билетов: ${c.tickets.length}. Билеты отправлены на ${c.email}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function downloadIcs(c: Pick<Confirmation, 'orderId' | 'email' | 'tickets'>) {
  const blob = new Blob([buildIcs(c)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neon-waves-2027.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
