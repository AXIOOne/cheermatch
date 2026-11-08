import { describe, expect, it } from 'vitest';
import { hasSubmissionVideo } from '@/lib/submission-video';

describe('manual upload retry eligibility', () => {
  it('does not exclude a team for an empty placeholder', () => {
    expect(hasSubmissionVideo({ brightcove_video_id: null, video_url: null })).toBe(false);
  });
  it('excludes teams with uploaded host videos', () => {
    expect(hasSubmissionVideo({ brightcove_video_id: '1234', video_url: null })).toBe(true);
  });
  it('excludes teams with an existing direct video', () => {
    expect(hasSubmissionVideo({ video_url: 'https://example.com/video.mp4' })).toBe(true);
  });
});