/** Fills the bytes with random values; `crypto.getRandomValues` in the browser. */
export type RandomBytes = (bytes: Uint8Array) => void;

const browserRandom: RandomBytes = (bytes) => {
  crypto.getRandomValues(bytes);
};

/**
 * A random v4 uuid for the save. It is built from `getRandomValues` because `randomUUID`
 * is missing on pages served over plain http (a phone in the local network).
 */
export function makeInstallId(random: RandomBytes = browserRandom): string {
  const bytes = new Uint8Array(16);
  random(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  let text = '';
  bytes.forEach((byte, index) => {
    if (index === 4 || index === 6 || index === 8 || index === 10) text += '-';
    text += byte.toString(16).padStart(2, '0');
  });
  return text;
}
