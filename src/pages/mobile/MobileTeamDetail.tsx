import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mobileApi } from "@/lib/mobile-api";

type Submission = { id: string; status: string; submitted_at: string } | null;

export default function MobileTeamDetail() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission>(null);
  const [teamName, setTeamName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.teams(eventId);
        if (res.status && Array.isArray(res.data)) {
          const t = (res.data as Array<Record<string, unknown>>).find(
            (x) => String(x.team_id) === teamId,
          );
          if (t) {
            setTeamName(String(t.team_name ?? ""));
            const sub = t.submission as Submission;
            if (sub && sub.id) setSubmission(sub);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, teamId]);

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-xl mx-auto">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Once a submission exists, recording is locked. Coach must use the attempts
  // available within a single capture session — no re-submissions.
  if (submission) {
    return (
      <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
          <h1 className="text-xl font-bold">Video already submitted</h1>
          {teamName && <p className="text-sm font-medium mt-1">{teamName}</p>}
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            A performance video has already been submitted for this team. Only one
            submission is allowed per team, per event.
          </p>
          <Button
            variant="secondary"
            className="w-full h-12 text-base"
            onClick={() => navigate(`/m/events/${eventId}`)}
          >
            Back to teams
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      <Card className="p-6 text-center">
        <Video className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-bold">Ready to record?</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Make sure your phone is in landscape mode, the lighting is good, and you have a stable view of the entire performance area.
        </p>
        <Button asChild className="w-full h-12 text-base">
          <Link to={`/m/events/${eventId}/teams/${teamId}/record`}>Start recording</Link>
        </Button>
      </Card>
    </div>
  );
}
