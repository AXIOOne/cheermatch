import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@4.0.0'

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

    const { submissionId }: ScoreSheetRequest = await req.json();

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
          division:divisions(name),
          level:levels(name)
        ),
        event:events(id, name),
        scores:scores(
          id,
          total_score,
          deductions,
          comments,
          status,
          submitted_at,
          panel:judge_panels(name, abbreviation),
          score_details:score_details(
            points,
            notes,
            category:scoring_categories(name, max_points, weight)
          )
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

    // Calculate overall average
    const avgScore = submittedScores.reduce((sum: number, s: any) => sum + (s.total_score || 0), 0) / submittedScores.length;

    // Build score breakdown HTML
    const scoreBreakdownHtml = submittedScores.map((score: any) => {
      const panel = Array.isArray(score.panel) ? score.panel[0] : score.panel;
      const panelName = panel?.name || "Judge";
      const details = score.score_details?.map((d: any) => {
        const category = Array.isArray(d.category) ? d.category[0] : d.category;
        return `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${category?.name || "Category"}</td><td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${d.points} / ${category?.max_points || 0}</td></tr>`;
      }).join("") || "";

      return `
        <div style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #f5f5f5; padding: 12px 16px; font-weight: bold;">
            ${panelName} - Score: ${score.total_score?.toFixed(2) || "N/A"}
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            ${details}
          </table>
          ${score.deductions ? `<div style="padding: 8px 16px; color: #dc2626;">Deductions: -${score.deductions}</div>` : ""}
          ${score.comments ? `<div style="padding: 8px 16px; font-style: italic; color: #666;">Comments: ${score.comments}</div>` : ""}
        </div>
      `;
    }).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
          .highlight { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .score-big { font-size: 48px; font-weight: bold; color: #6366f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Score Sheet</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${event?.name || "Event"}</p>
          </div>
          <div class="content">
            <p>Dear ${coachProfile.full_name || "Coach"},</p>
            <p>Here are the official scores for your team's performance:</p>
            
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Team:</strong> ${team.name || "Team"}</p>
              <p style="margin: 8px 0 0 0;"><strong>Gym:</strong> ${team.gym_name || ""}</p>
              <p style="margin: 8px 0 0 0;"><strong>Division:</strong> ${division?.name || "N/A"}</p>
              <p style="margin: 8px 0 0 0;"><strong>Level:</strong> ${level?.name || "N/A"}</p>
            </div>

            <div class="highlight">
              <p style="margin: 0; color: #666;">Average Score</p>
              <div class="score-big">${avgScore.toFixed(2)}</div>
            </div>

            <h2>Score Breakdown</h2>
            ${scoreBreakdownHtml}

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              If you have any questions about your scores, please contact the event organizers.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "CheerMatch <noreply@cheermatch.com>",
      to: [coachProfile.email],
      subject: `Score Sheet - ${team.name || "Team"} | ${event?.name || "Event"}`,
      html: emailHtml,
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
