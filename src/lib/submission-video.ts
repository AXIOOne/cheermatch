/** A pending admin placeholder isn't an uploaded performance. */
export function hasSubmissionVideo(submission: {
  brightcove_video_id?: string | null;
  video_url?: string | null;
}): boolean {
  return Boolean(submission.brightcove_video_id || submission.video_url);
}