export type RegistrationVideoStage = 'not-started' | 'capture-started' | 'awaiting-approval' | 'approved';

export interface RegistrationVideoSubmission {
  team_id: string | null;
  status: string;
  created_at: string;
  archived_at: string | null;
  video_url?: string | null;
  brightcove_video_id?: string | null;
}

export interface RegistrationCaptureAttempt {
  team_id: string;
  voided_at: string | null;
}

export function registrationVideoProgress(
  teamId: string,
  submissions: RegistrationVideoSubmission[],
  attempts: RegistrationCaptureAttempt[],
): { stage: RegistrationVideoStage; status: string } {
  const latest = submissions
    .filter(s => s.team_id === teamId && !s.archived_at)
    .reduce<RegistrationVideoSubmission | undefined>((current, s) =>
      !current || s.created_at > current.created_at ? s : current, undefined);

  if (latest) {
    if (['approved', 'assigned', 'complete'].includes(latest.status)) {
      return { stage: 'approved', status: latest.status };
    }
    if (latest.status === 'pending' && !latest.video_url && !latest.brightcove_video_id) {
      return { stage: 'capture-started', status: 'capture_started' };
    }
    return { stage: 'awaiting-approval', status: latest.status };
  }
  if (attempts.some(a => a.team_id === teamId && !a.voided_at)) {
    return { stage: 'capture-started', status: 'capture_started' };
  }
  return { stage: 'not-started', status: 'not_started' };
}