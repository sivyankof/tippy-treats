import { describe, expect, it } from 'vitest';
import { buildMailBody, buildMailto } from './mailto';

describe('buildMailBody', () => {
  it('puts the intro, room for the player, a rule and one line per fact', () => {
    expect(
      buildMailBody('Write here', [
        { label: 'Game', value: '0.1.0' },
        { label: 'Device', value: 'iPhone' },
      ]),
    ).toBe('Write here\n\n\n--------\nGame: 0.1.0\nDevice: iPhone');
  });

  it('keeps every fact on one line', () => {
    const body = buildMailBody('Hi', [{ label: 'Device', value: 'Pixel\r\n7\nPro' }]);
    expect(body.endsWith('Device: Pixel 7 Pro')).toBe(true);
  });
});

describe('buildMailto', () => {
  it('encodes the subject and the body, line ends as CRLF', () => {
    const url = buildMailto('help@example.org', 'A & B: "hi"', 'Строка 1\nline 2 + 3?');
    expect(url.startsWith('mailto:help@example.org?subject=')).toBe(true);
    expect(url).toContain('subject=A%20%26%20B%3A%20%22hi%22');
    expect(url).toContain('&body=');
    expect(url).toContain('%0D%0Aline%202%20%2B%203%3F');
    expect(url).toContain(encodeURIComponent('Строка 1'));
    expect(url).not.toMatch(/[ \n"]/);
  });

  it('round-trips through the decoder of a mail program', () => {
    const body = 'Игра: 0.1.0\nСборка: 4 (abc1234)';
    const url = new URL(buildMailto('help@example.org', 'Тема', body));
    expect(url.searchParams.get('subject')).toBe('Тема');
    expect(url.searchParams.get('body')).toBe(body.replace(/\n/g, '\r\n'));
  });

  it('does not let the recipient carry extra fields', () => {
    const url = new URL(buildMailto('a@b.c?cc=x&bcc=y', 's', 'b'));
    expect([...url.searchParams.keys()]).toEqual(['subject', 'body']);
  });
});
