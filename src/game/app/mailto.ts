/** A line of the facts block of a letter: a label and its value. */
export interface MailFact {
  label: string;
  value: string;
}

/** The line between the player's own text and the facts the support needs. */
const FACTS_RULE = '--------';

/** A value on one line: line breaks inside it would break the block. */
const oneLine = (text: string): string => text.replace(/[\r\n]+/g, ' ').trim();

/**
 * The body of a support letter: `intro`, a blank line for the player's own words, a rule and one
 * "label: value" line per fact. Plain text, `\n` line ends (the address turns them into `%0D%0A`).
 */
export function buildMailBody(intro: string, facts: readonly MailFact[]): string {
  const lines = facts.map((fact) => `${oneLine(fact.label)}: ${oneLine(fact.value)}`);
  return [intro, '', '', FACTS_RULE, ...lines].join('\n');
}

/**
 * A `mailto:` address (RFC 6068): subject and body percent-encoded, line breaks as `%0D%0A`. The
 * recipient is kept as it is apart from the characters that would end it.
 */
export function buildMailto(to: string, subject: string, body: string): string {
  const encode = (text: string): string => encodeURIComponent(text.replace(/\r?\n/g, '\r\n'));
  return `mailto:${to.replace(/[?&#\s]/g, '')}?subject=${encode(subject)}&body=${encode(body)}`;
}
