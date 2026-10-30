import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { buildScoresheet, type RawField, type ScoreType } from '../_shared/build-scoresheet.ts'
import { buildScoresheetPdf } from '../_shared/scoresheet-pdf.ts'
import { scoresheetEmailHtml, scoresheetEmailSubject, resolveEmailSubject, EMAIL_SUBJECTS_SETTINGS_KEY } from '../_shared/email-layouts.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreSheetRequest {
  submissionId: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Email service not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin-only
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData } = await supabase.auth.getUser(jwt);
    const callerId = authData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body = await req.json();
    const accuscoreRequestId: string | null = typeof body?.accuscoreRequestId === "string" ? body.accuscoreRequestId : null;
    const appUrl: string = typeof body?.appUrl === "string" && /^https?:\/\//.test(body.appUrl)
      ? body.appUrl.replace(/\/$/, "") : "https://score.cheermatch.com";
    let submissionId: string | null = typeof body?.submissionId === "string" ? body.submissionId : null;

    let accuscoreReq: any = null;
    if (accuscoreRequestId) {
      const { data } = await supabase.from("accuscore_requests")
        .select("*, form:accuscore_forms(name)").eq("id", accuscoreRequestId).single();
      if (!data) throw new Error("AccuScore request not found");
      accuscoreReq = data;
      submissionId = data.submission_id;
    }

    if (!submissionId) {
      throw new Error("Missing submission ID");
    }

    // Fetch submission with team, event, and scores
    const { data: submission, error: submissionError } = await supabase
      .from("video_submissions")
      .select(`
        id,
        team:teams(
          id,
          name,
          gym_name,
          coach_user_id,
          division:divisions(id, name, scoring_template_id, discipline_links:division_disciplines(discipline, scoring_template_id)),
          level:levels(name)
        ),
        event:events(id, name, discipline, accuscore_end_at, accuscore_enabled, time_zone),
        scores:scores(
          id,
          total_score,
          deductions,
          comments,
          status,
          submitted_at,
          template_id,
          template:scoring_templates(show_comments_on_scoresheet),
          panel:judge_panels(name, abbreviation),
          score_details:score_details(
            points,
            notes,
            field:scoring_fields(id, name, max_points, section_id, score_type, display_order,
              section:scoring_sections(id, name, display_order))
          ),
          deduction_items:score_deductions(deduction_type_id, count, warnings)
        )

      `)
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error("Submission not found");
    }

    // Handle array returns from Supabase joins
    const team = Array.isArray(submission.team) ? submission.team[0] : submission.team;
    const event = Array.isArray(submission.event) ? submission.event[0] : submission.event;
    const division = team?.division ? (Array.isArray(team.division) ? team.division[0] : team.division) : null;
    const level = team?.level ? (Array.isArray(team.level) ? team.level[0] : team.level) : null;

    if (!team) {
      throw new Error("Team not found");
    }

    // Get coach email
    const { data: coachProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", team.coach_user_id)
      .single();

    if (profileError || !coachProfile?.email) {
      throw new Error("Coach email not found");
    }

    // Filter to only submitted scores
    const submittedScores = submission.scores?.filter((s: any) => s.status === "submitted") || [];

    if (submittedScores.length === 0) {
      throw new Error("No submitted scores to send");
    }

    // Load admin overrides for these scores
    const submittedIds = submittedScores.map((s: any) => s.id);
    const overrideLookup: Record<string, Record<string, number>> = {};
    if (submittedIds.length) {
      const { data: ovs } = await supabase.from('score_field_overrides')
        .select('score_id, field_id, new_points').in('score_id', submittedIds);
      (ovs || []).forEach((o: any) => {
        if (!overrideLookup[o.score_id]) overrideLookup[o.score_id] = {};
        overrideLookup[o.score_id][o.field_id] = Number(o.new_points || 0);
      });
    }

    // AccuScore link: reuse or create this team's review token
    const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    let accuscoreUrl: string | null = null;
    const cutoff = (event as any)?.accuscore_end_at as string | null;
    const { count: enabledFormCount } = await supabase.from("event_accuscore_forms")
      .select("id, form:accuscore_forms!inner(is_active)", { count: "exact", head: true })
      .eq("event_id", (event as any)?.id).eq("form.is_active", true);
    const accuscoreOn = (event as any)?.accuscore_enabled !== false && (enabledFormCount || 0) > 0;
    const { count: critiqueCount } = (event as any)?.verbal_critiques_enabled
      ? await supabase.from("verbal_critiques").select("id", { count: "exact", head: true })
          .eq("submission_id", submissionId).in("score_id", submittedScores.map((s: any) => s.id))
      : { count: 0 };
    if (accuscoreOn || accuscoreReq || (critiqueCount || 0) > 0) {
      const { data: existing } = await supabase.from("scoring_review_tokens")
        .select("id, token").eq("submission_id", submissionId).eq("coach_email", coachProfile.email)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      let token = existing?.token as string | undefined;
      const expiresAt = cutoff || new Date(Date.now() + 30 * 86400000).toISOString();
      if (!token) {
        token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
        await supabase.from("scoring_review_tokens").insert({
          submission_id: submissionId, token, coach_email: coachProfile.email,
          coach_name: coachProfile.full_name, expires_at: expiresAt, created_by: callerId, status: "pending",
        });
      } else {
        await supabase.from("scoring_review_tokens").update({ expires_at: expiresAt }).eq("id", existing!.id);
      }
      accuscoreUrl = `${appUrl}/review/${token}`;
    }
    const tz = (event as any)?.time_zone || "America/Chicago";
    const cutoffText = cutoff ? new Date(cutoff).toLocaleString("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short", timeZoneName: "short" } as any) : null;
    const decisionLabel: Record<string, string> = { honored: "Honored", denied: "Denied", duplicate: "Duplicate" };
    // Calculate overall average
    const avgScore = submittedScores.reduce((sum: number, s: any) => sum + (s.total_score || 0), 0) / submittedScores.length;

    const emailHtml = scoresheetEmailHtml({
      eventName: event?.name || "Event",
      coachName: coachProfile.full_name,
      teamName: team.name || team.gym_name || "Team",
      gymName: team.gym_name,
      divisionName: division?.name,
      levelName: level?.name,
      averageScore: avgScore,
      critiquesUrl: (critiqueCount || 0) > 0 ? accuscoreUrl : null,
      accuscore: accuscoreOn && accuscoreUrl ? { url: accuscoreUrl, cutoffText } : null,
      response: accuscoreReq ? { formName: accuscoreReq.form?.name || "Score review", decision: decisionLabel[accuscoreReq.status] || accuscoreReq.status, response: accuscoreReq.admin_response || "" } : null,
      panels: submittedScores.map((score: any) => {
        const panel = Array.isArray(score.panel) ? score.panel[0] : score.panel;
        return {
          panelName: panel?.name || "Judge",
          total: score.total_score ?? null,
          deductions: score.deductions,
          comments: score.comments,
          rows: (score.score_details || []).map((d: any) => {
            const field = Array.isArray(d.field) ? d.field[0] : d.field;
            const section = field?.section ? (Array.isArray(field.section) ? field.section[0] : field.section) : null;
            return { label: section?.name ? `${section.name} — ${field?.name || "Field"}` : (field?.name || "Field"), points: d.points, max: field?.max_points || 0 };
          }),
        };
      }),
    });


    // Build PDF scoresheet
    const fieldMap = new Map<string, RawField>();

    // Derive show_comments from any submitted score's template
    const tplWithFlag = submittedScores
      .map((s: any) => Array.isArray(s.template) ? s.template[0] : s.template)
      .find((t: any) => t && t.show_comments_on_scoresheet);
    const showComments = !!tplWithFlag;

    // Resolve template: prefer submitted score's template, then the division's
    // template, then any event-bound template, then the global default.
    let templateId: string | null = submittedScores[0]?.template_id ?? null;
    if (!templateId) {
      const links = ((division as any)?.discipline_links || []) as Array<{ discipline: string; scoring_template_id: string | null }>;
      const eventDiscipline = (event as any)?.discipline ?? null;
      templateId =
        links.find((l) => l.discipline === eventDiscipline)?.scoring_template_id ??
        (links.length === 1 ? links[0].scoring_template_id : null) ??
        (division as any)?.scoring_template_id ??
        null;
    }
    if (!templateId && event?.id) {
      const { data: tpls } = await supabase
        .from('scoring_templates')
        .select('id, is_default')
        .eq('event_id', event.id)
        .order('is_default', { ascending: false })
        .limit(1);
      templateId = tpls?.[0]?.id ?? null;
    }
    if (!templateId) {
      const { data: tpls } = await supabase
        .from('scoring_templates')
        .select('id')
        .eq('is_default', true)
        .order('created_at')
        .limit(1);
      templateId = tpls?.[0]?.id ?? null;
    }


    let deductionCatalog: Array<{ id: string; name: string; points: number; display_order: number }> = [];
    if (templateId) {
      const { data: dts } = await supabase
        .from('deduction_types')
        .select('id, name, points, display_order')
        .eq('template_id', templateId);
      deductionCatalog = (dts || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        points: Number(d.points || 0),
        display_order: Number(d.display_order ?? 0),
      }));

      // Load ALL template fields so unscored criteria still render as blank rows.
      const { data: tplFields } = await supabase
        .from('scoring_fields')
        .select(`id, name, max_points, section_id, score_type, display_order,
                 section:scoring_sections!inner(id, name, display_order, template_id)`)
        .eq('section.template_id', templateId);
      (tplFields || []).forEach((f: any) => {
        const section = Array.isArray(f.section) ? f.section[0] : f.section;
        fieldMap.set(f.id, {
          id: f.id,
          name: f.name,
          max_points: Number(f.max_points || 0),
          score_type: ((f.score_type as ScoreType) || 'difficulty'),
          section_id: f.section_id,
          section_name: section?.name || '',
          section_order: section?.display_order ?? 0,
          field_order: f.display_order ?? 0,
        });
      });
    }

    // Safety net: pull in any legacy field referenced by score_details
    submittedScores.forEach((s: any) => {
      (s.score_details || []).forEach((d: any) => {
        const f = Array.isArray(d.field) ? d.field[0] : d.field;
        if (!f || fieldMap.has(f.id)) return;
        const section = Array.isArray(f.section) ? f.section[0] : f.section;
        fieldMap.set(f.id, {
          id: f.id,
          name: f.name,
          max_points: Number(f.max_points || 0),
          score_type: ((f.score_type as ScoreType) || 'difficulty'),
          section_id: f.section_id,
          section_name: section?.name || '',
          section_order: section?.display_order ?? 0,
          field_order: f.display_order ?? 0,
        });
      });
    });

    const sheetData = buildScoresheet({
      team_name: team.name || team.gym_name || 'Team',
      gym_name: team.gym_name,
      division_name: division?.name || null,
      level_name: level?.name || null,
      event_name: event?.name || 'Event',
      accuscore_end_at: (event as any)?.accuscore_end_at || null,
      fields: Array.from(fieldMap.values()),
      show_comments: showComments,
      deduction_catalog: deductionCatalog,
      submitted_scores: submittedScores.map((s: any) => {
        const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
        return {
          deductions: Number(s.deductions || 0),
          comments: s.comments || null,
          judge_label: panel?.name || panel?.abbreviation || null,
          panel_name: panel?.name || null,
          panel_abbreviation: panel?.abbreviation || null,
          deduction_items: (s.deduction_items || []).map((it: any) => ({
            deduction_type_id: it.deduction_type_id,
            count: Number(it.count || 0),
            warnings: Number(it.warnings || 0),
          })),
          details: (s.score_details || []).map((d: any) => {
            const fid = (Array.isArray(d.field) ? d.field[0] : d.field)?.id;
            const ov = overrideLookup[s.id]?.[fid];
            return {
              field_id: fid,
              points: ov !== undefined ? ov : Number(d.points || 0),
            };
          }),
        };
      }),
    });

    if (templateId) {
      const { data: lbl } = await supabase.from('scoring_templates').select('difficulty_label, execution_label').eq('id', templateId).maybeSingle();
      sheetData.difficulty_label = (lbl as any)?.difficulty_label;
      sheetData.execution_label = (lbl as any)?.execution_label;
    }
    const pdfBytes = await buildScoresheetPdf(sheetData);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, pdfBytes.subarray(i, i + CHUNK) as unknown as number[]);
    }
    const pdfBase64 = btoa(binary);
    const safeName = `${team.name || team.gym_name || 'Team'} - ${event?.name || 'Event'}`.replace(/[^\w\s-]/g, '').trim() || 'scoresheet';

    const { data: subjRow } = await supabase
      .from('platform_settings').select('value').eq('key', EMAIL_SUBJECTS_SETTINGS_KEY).maybeSingle();
    const emailSubject = resolveEmailSubject(
      (subjRow?.value ?? null) as Record<string, string> | null,
      accuscoreReq ? 'accuscore_response' : 'scoresheet',
      scoresheetEmailSubject(team.name || team.gym_name || "Team", event?.name || "Event", !!accuscoreReq),
      {
        teamName: team.name || team.gym_name || "Team",
        gymName: team.gym_name,
        eventName: event?.name || "Event",
        coachName: coachProfile.full_name,
        divisionName: division?.name,
        levelName: level?.name,
      },
    );

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "CheerMatch <noreply@cheermatch.com>",
      to: [coachProfile.email],
      subject: emailSubject,
      html: emailHtml,
      attachments: [{
        filename: `${safeName}.pdf`,
        content: pdfBase64,
      }],
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(emailError.message || "Failed to send email");
    }

    console.log("Score sheet email sent:", emailData);

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending score sheet:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
