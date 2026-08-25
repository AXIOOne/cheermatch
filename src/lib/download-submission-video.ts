import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves a direct MP4 rendition URL from the video host and triggers a browser download.
 * Falls back to opening the stored video URL when the submission is not hosted on Brightcove.
 */
export async function downloadSubmissionVideo(submissionId: string, fallbackUrl?: string | null) {
  const { data, error } = await supabase.functions.invoke('brightcove-download-url', {
    body: { submission_id: submissionId },
  });

  if (error) throw new Error(error.message);
  const payload = data as { status?: boolean; message?: string; data?: { url: string; filename: string } };

  if (!payload?.status || !payload.data?.url) {
    if (fallbackUrl && !/players\.brightcove\.net/.test(fallbackUrl)) {
      triggerDownload(fallbackUrl);
      return;
    }
    throw new Error(payload?.message || 'Could not resolve a download link');
  }

  triggerDownload(payload.data.url, payload.data.filename);
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
