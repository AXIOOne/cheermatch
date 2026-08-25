import { supabase } from '@/integrations/supabase/client';

export class VideoPreparingError extends Error {
  preparing = true;
}

type Payload = {
  status?: boolean;
  message?: string;
  data?: { url?: string; filename?: string; preparing?: boolean } | null;
};

async function resolve(submissionId: string, probe = false) {
  const { data, error } = await supabase.functions.invoke('brightcove-download-url', {
    body: { submission_id: submissionId, ...(probe ? { probe: true } : {}) },
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Payload;
}

/**
 * Resolves a direct MP4 rendition URL from the video host and triggers a browser download.
 * Falls back to opening the stored video URL when the submission is not hosted on Brightcove.
 */
export async function downloadSubmissionVideo(submissionId: string, fallbackUrl?: string | null) {
  const payload = await resolve(submissionId);

  if (!payload?.status || !payload.data?.url) {
    if (fallbackUrl && !/players\.brightcove\.net/.test(fallbackUrl)) {
      triggerDownload(fallbackUrl);
      return;
    }
    const message = payload?.message || 'Could not resolve a download link';
    if (payload?.data?.preparing) throw new VideoPreparingError(message);
    throw new Error(message);
  }

  triggerDownload(payload.data.url, payload.data.filename);
}

/** Status-only check: true when a downloadable copy now exists on the host. */
export async function isSubmissionVideoDownloadable(submissionId: string) {
  try {
    const payload = await resolve(submissionId, true);
    return !!(payload?.status && payload.data?.url);
  } catch {
    return false;
  }
}

function triggerDownload(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
