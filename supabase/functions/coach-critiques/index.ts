import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { coachCritiques, type Critique } from './handler.ts';

const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'Audio unavailable' }, 500);
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await coachCritiques(body?.review_token, async token => {
      // Validate the bearer review link before resolving any storage paths. The RPC
      // additionally scopes recordings to this submission, enabled events and submitted scores.
      const { data: review, error } = await sb.from('scoring_review_tokens').select('id').eq('token', token).maybeSingle();
      if (error) throw new Error('Review lookup failed');
      if (!review) return null;
      const { data, error: critiqueError } = await sb.rpc('get_verbal_critiques', { review_token: token });
      if (critiqueError) throw new Error('Critique lookup failed');
      return (data || []) as Critique[];
    }, async (path, seconds) => {
      const { data, error } = await sb.storage.from('verbal-critiques').createSignedUrl(path, seconds);
      if (error) throw new Error('Audio unavailable');
      return data?.signedUrl || null;
    });
    return respond(result.body, result.status);
  } catch {
    return respond({ error: 'Unable to load judge audio' }, 500);
  }
});