import { describe, it, expect, vi } from 'vitest';
import { coachCritiques } from '../../supabase/functions/coach-critiques/handler';

describe('token-gated coach audio', () => {
  it('rejects missing links before looking up or signing audio', async () => {
    const lookup = vi.fn(); const sign = vi.fn();
    expect((await coachCritiques('', lookup, sign)).status).toBe(400);
    expect(lookup).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled();
  });
  it('never signs audio for an invalid review link', async () => {
    const sign = vi.fn();
    expect((await coachCritiques('forged-link', async () => null, sign)).status).toBe(403);
    expect(sign).not.toHaveBeenCalled();
  });
  it('only signs the recordings returned for the validated submission, for one hour', async () => {
    const sign = vi.fn(async () => 'signed-audio');
    const result = await coachCritiques('valid-link', async () => [{ panel_name: 'J1', storage_path: 'judge/own-team.webm', duration_seconds: 15 }], sign);
    expect(sign).toHaveBeenCalledExactlyOnceWith('judge/own-team.webm', 3600);
    expect(result.body).toEqual({ critiques: [{ panel_name: 'J1', duration_seconds: 15, url: 'signed-audio' }] });
  });
  it('does not sign audio when the event or submitted-score filter returns none', async () => {
    const sign = vi.fn();
    expect((await coachCritiques('valid-link', async () => [], sign)).body).toEqual({ critiques: [] });
    expect(sign).not.toHaveBeenCalled();
  });
});