import { describe, expect, it } from 'vitest';
import { registrationVideoProgress, type RegistrationVideoSubmission } from '@/lib/registration-video-progress';

const submission = (status: string, overrides: Partial<RegistrationVideoSubmission> = {}): RegistrationVideoSubmission => ({
  team_id: 'team', status, created_at: '2026-10-23T16:00:00Z', archived_at: null, ...overrides,
});

describe('registration video progress', () => {
  it('marks initiated, unsubmitted capture as capture-started', () => {
    expect(registrationVideoProgress('team', [], [{ team_id: 'team', voided_at: null }]).stage).toBe('capture-started');
    expect(registrationVideoProgress('team', [submission('pending')], []).stage).toBe('capture-started');
  });
  it('marks videos received but not approved as awaiting-approval', () => {
    for (const status of ['uploaded', 'processing', 'ready', 'imported', 'revision_requested', 'denied', 'failed']) {
      expect(registrationVideoProgress('team', [submission(status)], []).stage).toBe('awaiting-approval');
    }
    expect(registrationVideoProgress('team', [submission('pending', { video_url: 'video.mp4' })], []).stage).toBe('awaiting-approval');
  });
  it('keeps approved videos green through judge assignment and completed scoring', () => {
    for (const status of ['approved', 'assigned', 'complete']) {
      expect(registrationVideoProgress('team', [submission(status)], []).stage).toBe('approved');
    }
  });
  it('uses the latest active submission rather than an archived approval or older video', () => {
    expect(registrationVideoProgress('team', [submission('approved'), submission('ready', { created_at: '2026-10-23T17:00:00Z' })], []).stage).toBe('awaiting-approval');
    expect(registrationVideoProgress('team', [submission('approved', { archived_at: '2026-10-23T17:00:00Z' })], []).stage).toBe('not-started');
  });
  it('leaves untouched teams neutral and ignores voided or other-team attempts', () => {
    expect(registrationVideoProgress('team', [], [{ team_id: 'team', voided_at: '2026-10-23' }, { team_id: 'other', voided_at: null }]).stage).toBe('not-started');
  });
});