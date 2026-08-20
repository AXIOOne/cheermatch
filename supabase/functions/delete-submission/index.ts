import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bcDeleteVideo } from '../_shared/brightcove.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No authorization header' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, 401)

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Unauthorized - Admin access required' }, 403)

    const body = await req.json().catch(() => ({}))
    const submissionId: string | undefined = body?.submissionId
    const deleteVideo: boolean = body?.deleteVideo === true
    if (!submissionId || typeof submissionId !== 'string') {
      return json({ error: 'submissionId is required' }, 400)
    }

    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('video_submissions')
      .select('id, archived_at, brightcove_video_id')
      .eq('id', submissionId)
      .maybeSingle()

    if (fetchError) return json({ error: fetchError.message }, 400)
    if (!submission) return json({ error: 'Submission not found' }, 404)
    if (!submission.archived_at) {
      return json({ error: 'Submission must be archived before it can be permanently deleted' }, 400)
    }

    // Remove the hosted video first — if this fails we keep the record so it can be retried.
    if (deleteVideo && submission.brightcove_video_id) {
      try {
        await bcDeleteVideo(submission.brightcove_video_id)
      } catch (e) {
        console.error('Brightcove delete failed', e)
        return json({ error: `Could not delete the hosted video: ${(e as Error).message}. Nothing was removed.` }, 502)
      }
    }

    // Score-related children
    const { data: scores } = await supabaseAdmin
      .from('scores')
      .select('id')
      .eq('submission_id', submissionId)

    const scoreIds = (scores ?? []).map((s: { id: string }) => s.id)
    if (scoreIds.length > 0) {
      for (const table of ['score_details', 'score_deductions', 'score_skill_selections', 'score_field_overrides']) {
        const { error } = await supabaseAdmin.from(table).delete().in('score_id', scoreIds)
        if (error) return json({ error: `${table}: ${error.message}` }, 400)
      }
      const { error: scoresError } = await supabaseAdmin.from('scores').delete().in('id', scoreIds)
      if (scoresError) return json({ error: scoresError.message }, 400)
    }

    const { error: tokenError } = await supabaseAdmin
      .from('scoring_review_tokens')
      .delete()
      .eq('submission_id', submissionId)
    if (tokenError) return json({ error: tokenError.message }, 400)

    const { error: deleteError } = await supabaseAdmin
      .from('video_submissions')
      .delete()
      .eq('id', submissionId)
    if (deleteError) return json({ error: deleteError.message }, 400)

    console.log(`Submission ${submissionId} deleted by admin ${user.id} (video removed: ${deleteVideo})`)
    return json({ success: true, videoDeleted: deleteVideo && !!submission.brightcove_video_id })
  } catch (error) {
    console.error('delete-submission error', error)
    return json({ error: (error as Error).message ?? 'Internal server error' }, 500)
  }
})
