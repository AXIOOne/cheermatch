import { describe, expect, it } from 'vitest';
import { exportWriteMode } from '../../supabase/functions/_shared/dropbox-export-save';

describe('Dropbox export persistence', () => {
  it('updates completed status without inserting a row missing its required event', () => {
    expect(exportWriteMode({ status: 'completed', error: null })).toBe('update');
  });
  it('updates failed status without inserting a row missing its required event', () => {
    expect(exportWriteMode({ status: 'failed', error: 'download_failed' })).toBe('update');
  });
  it('allows a new export only when its event is supplied', () => {
    expect(exportWriteMode({ event_id: 'event-123', status: 'transferring' })).toBe('upsert');
  });
});