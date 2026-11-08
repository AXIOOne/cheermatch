import 'fake-indexeddb/auto';
import { Blob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAttempts, finalizeAttempt, listAttempts, reconcileAttempts, reserveAttempt } from '@/lib/capture-attempts';

const key = 'test-event::test-team';
afterEach(async () => { await clearAttempts(key); vi.restoreAllMocks(); });

describe('capture reconciliation', () => {
  it('preserves offline footage when an online server list omits it', async () => {
    const attempt = await reserveAttempt(key);
    await finalizeAttempt(attempt.id, new Blob(['recorded video']) as unknown as globalThis.Blob, 30);
    await reconcileAttempts(key, []);
    const saved = await listAttempts(key);
    expect(saved).toHaveLength(1);
    expect(saved[0].complete).toBe(true);
    expect(saved[0].blob?.size).toBe(14);
  });
  it('removes an explicitly server-reserved take after admin reset', async () => {
    const attempt = await reserveAttempt(key, 1);
    await finalizeAttempt(attempt.id, new Blob(['recorded video']) as unknown as globalThis.Blob, 30);
    await reconcileAttempts(key, []);
    expect(await listAttempts(key)).toHaveLength(0);
  });
  it('retains footage for an active server take', async () => {
    const attempt = await reserveAttempt(key, 1);
    await finalizeAttempt(attempt.id, new Blob(['recorded video']) as unknown as globalThis.Blob, 30);
    await reconcileAttempts(key, [1]);
    expect((await listAttempts(key))[0].complete).toBe(true);
  });
});