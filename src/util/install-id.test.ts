import { describe, expect, it } from 'vitest';
import { makeInstallId } from './install-id';

describe('makeInstallId', () => {
  it('formats a v4 uuid', () => {
    const id = makeInstallId((bytes) => bytes.fill(255));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('differs between calls with the real random source', () => {
    expect(makeInstallId()).not.toBe(makeInstallId());
  });
});
