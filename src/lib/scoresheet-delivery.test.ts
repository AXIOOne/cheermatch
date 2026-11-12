import { describe, expect, it } from 'vitest';
import { canSendAll, scoresheetReviewed, shouldSendUnsent, providerDeliveryStatus, sendUnsentSequentially } from '../../supabase/functions/_shared/scoresheet-delivery';

describe('reviewed-only scoresheet sending', () => {
  const reviewed = { panel_id: 'J1', status: 'submitted', reviewed_at: '2026-11-12T06:12:00Z' };
  it('requires every relevant panel to be submitted and reviewed', () => {
    expect(scoresheetReviewed([reviewed], ['J1', 'SD'])).toBe(false);
    expect(scoresheetReviewed([reviewed, { ...reviewed, panel_id: 'SD', reviewed_at: null }], ['J1', 'SD'])).toBe(false);
    expect(scoresheetReviewed([reviewed, { ...reviewed, panel_id: 'SD' }], ['J1', 'SD'])).toBe(true);
  });
  it('does not treat a reviewed draft as complete', () => {
    expect(scoresheetReviewed([{ ...reviewed, status: 'in_progress' }], ['J1'])).toBe(false);
  });
  it('activates bulk sending only after all event scoresheets are reviewed', () => {
    expect(canSendAll([true, false], true, 1)).toBe(false);
    expect(canSendAll([true, true], true, 1)).toBe(true);
    expect(canSendAll([true], false, 1)).toBe(false);
    expect(canSendAll([], true, 1)).toBe(false);
    expect(canSendAll([true], true, 0)).toBe(false);
  });
});

describe('email outcomes and retry selection', () => {
  it('skips accepted and in-flight sends, but includes unsent and failed emails', () => {
    expect(shouldSendUnsent(undefined, false)).toBe(true);
    expect(shouldSendUnsent(undefined, true)).toBe(false);
    for (const status of ['sent', 'delivered', 'sending', 'delayed', 'unknown', 'complained'] as const) {
      expect(shouldSendUnsent({ status }, true)).toBe(false);
    }
    expect(shouldSendUnsent({ status: 'failed' }, true)).toBe(true);
    expect(shouldSendUnsent({ status: 'bounced' }, true)).toBe(true);
  });
  it('distinguishes email acceptance from delivery and bounce/failure', () => {
    expect(providerDeliveryStatus('sent')).toBe('sent');
    expect(providerDeliveryStatus('delivered')).toBe('delivered');
    expect(providerDeliveryStatus('opened')).toBe('delivered');
    expect(providerDeliveryStatus('bounced')).toBe('bounced');
    expect(providerDeliveryStatus('failed')).toBe('failed');
    expect(providerDeliveryStatus('delivery_delayed')).toBe('delayed');
    expect(providerDeliveryStatus(undefined)).toBe('unknown');
  });
  it('continues sending remaining teams after a single failure, one at a time', async () => {
    let active = 0;
    const visited: string[] = [];
    const progress: number[] = [];
    const result = await sendUnsentSequentially(['one', 'two', 'three'], async item => {
      expect(active).toBe(0);
      active++;
      await Promise.resolve();
      visited.push(item);
      active--;
      if (item === 'two') throw new Error('Email rejected');
    }, done => progress.push(done));
    expect(visited).toEqual(['one', 'two', 'three']);
    expect(progress).toEqual([1, 2, 3]);
    expect(result).toEqual({ sent: 2, failed: 1 });
  });
});