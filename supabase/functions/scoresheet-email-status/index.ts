import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { providerDeliveryStatus } from '../_shared/scoresheet-delivery.ts';

Deno.serve(async req => {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const emailKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !key || !emailKey) throw new Error('Email status service is not configured');
    const db = createClient(url, key);
    const { data: auth } = await db.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!auth.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    const { data: admin } = await db.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' });
    if (!admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    const body = await req.json();
    if (typeof body.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.eventId)) {
      return new Response(JSON.stringify({ error: 'Invalid event identifier' }), { status: 400, headers });
    }
    const { data: submissions, error: submissionError } = await db.from('video_submissions')
      .select('id').eq('event_id', body.eventId).is('archived_at', null).not('team_id', 'is', null);
    if (submissionError) throw submissionError;
    const ids = (submissions || []).map(s => s.id);
    if (!ids.length) return new Response(JSON.stringify({ checked: 0 }), { headers });
    const [{ data: deliveries, error: deliveryError }, { data: receipts, error: receiptError }] = await Promise.all([
      db.from('scoresheet_email_deliveries').select('*').in('submission_id', ids),
      db.from('scoresheet_email_receipts').select('*').in('submission_id', ids),
    ]);
    if (deliveryError || receiptError) throw deliveryError || receiptError;
    const knownIds = new Set((deliveries || []).map(d => d.submission_id));
    const legacy = (receipts || []).filter(r => !knownIds.has(r.submission_id)).map(r => ({
      submission_id: r.submission_id, email_id: r.email_id, status: 'sent', updated_at: r.sent_at,
    }));
    if (legacy.length) {
      const { error } = await db.from('scoresheet_email_deliveries').upsert(legacy, { onConflict: 'submission_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    // Oldest unchecked sends first, so long event lists are checked fairly over subsequent polls.
    const candidates = [...(deliveries || []), ...legacy].filter(d => d.email_id && !['failed', 'bounced', 'complained'].includes(d.status))
      .sort((a: any, b: any) => (a.checked_at || '').localeCompare(b.checked_at || '')).slice(0, 8);
    const resend = new Resend(emailKey);
    let checked = 0;
    const checkErrors: string[] = [];
    for (const row of candidates) {
      if (!row.email_id) continue;
      if (checked) await new Promise(resolve => setTimeout(resolve, 600));
      const { data, error } = await resend.emails.get(row.email_id);
      if (error || !data) {
        checkErrors.push(error?.message || 'No email delivery status returned');
        // An inability to check is not evidence that delivery failed.
        const { error: saved } = await db.from('scoresheet_email_deliveries')
          .update({ checked_at: new Date().toISOString() }).eq('submission_id', row.submission_id).eq('email_id', row.email_id);
        if (saved) throw saved;
      } else {
        const status = providerDeliveryStatus((data as any).last_event);
        const { error: saved } = await db.from('scoresheet_email_deliveries').update({
          status, error: ['failed', 'bounced', 'complained'].includes(status) ? `Email service reported ${status}.` : null,
          checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('submission_id', row.submission_id).eq('email_id', row.email_id);
        if (saved) throw saved;
      }
      checked++;
    }
    return new Response(JSON.stringify({ checked, checkError: checkErrors[0] || null }), { headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Unable to check email status' }), { status: 500, headers });
  }
});