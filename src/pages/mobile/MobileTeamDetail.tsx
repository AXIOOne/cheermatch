import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import VideoPlayer from "@/components/video/VideoPlayer";
import { mobileApi } from "@/lib/mobile-api";

type Submission = {
  id: string;
  status: string;
  submitted_at?: string;
  review_notes?: string;
  video_url?: string;
  thumbnail_url?: string;
} | null;

type EventInfo = {
  submission_open_at?: string;
  submission_close_at?: string;
} | null;

export default function MobileTeamDetail() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [ev, setEv] = useState<EventInfo>(null);

  useEffect(() => {
    (async () => {
      try {
        const [teamsRes, eventsRes] = await Promise.all([
          mobileApi.teams(eventId),
          mobileApi.events(),
        ]);
        if (teamsRes.status && Array.isArray(teamsRes.data)) {
          const t = (teamsRes.data as Array<Record<string, unknown>>).find(
            (x) => String(x.team_id) === teamId,
          );
          if (t) {
            setTeamName(String(t.team_name ?? ""));
            const sub = t.submission as Submission;
            if (sub && sub.id) setSubmission(sub);
          }
        }
        if (eventsRes.status && Array.isArray(eventsRes.data)) {
          const e = (eventsRes.data as Array<Record<string, unknown>>).find(
            (x) => String(x.id) === eventId,
          );
          if (e) setEv({
            submission_open_at: e.submission_open_at as string | undefined,
            submission_close_at: e.submission_close_at as string | undefined,
          });
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

  const now = Date.now();
  const openAt = ev?.submission_open_at ? new Date(ev.submission_open_at).getTime() : null;
  const closeAt = ev?.submission_close_at ? new Date(ev.submission_close_at).getTime() : null;
  const windowOpen = (openAt == null || now >= openAt) && (closeAt == null || now <= closeAt);

  const isRevisionRequested = submission?.status === "revision_requested";
  const hasLockedSubmission = submission && !isRevisionRequested;

  if (hasLockedSubmission) {
    return (
      <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
          <h1 className="text-xl font-bold">Video already submitted</h1>
          {teamName && <p className="text-sm font-medium mt-1">{teamName}</p>}
          <p className="text-sm text-muted-foreground mt-2 mb-2">
            Status: <span className="font-medium capitalize">{submission?.status?.replace(/_/g, " ")}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            A performance video has been submitted for this team. Only one submission per team, per event.
          </p>

          {submission?.video_url ? (
            <div className="mb-6 text-left">
              <p className="text-sm font-medium mb-2">Submitted video</p>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {/players\.brightcove\.net|player\.vimeo\.com|youtube\.com\/embed|youtu\.be/.test(submission.video_url) ? (
                  <iframe
                    src={submission.video_url}
                    title="Submitted performance video"
                    className="w-full h-full"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={submission.video_url}
                    controls
                    playsInline
                    poster={submission.thumbnail_url || undefined}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-6">
              Your video is still processing. Check back shortly to watch it here.
            </p>
          )}
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

  if (!windowOpen) {
    return (
      <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Submission window closed</h1>
          {teamName && <p className="text-sm font-medium mt-1">{teamName}</p>}
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {openAt && now < openAt
              ? `Opens ${new Date(openAt).toLocaleString()}`
              : closeAt ? `Closed ${new Date(closeAt).toLocaleString()}` : "Not currently accepting submissions."}
          </p>
          <Button variant="secondary" className="w-full h-12 text-base" onClick={() => navigate(`/m/events/${eventId}`)}>
            Back to teams
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      {isRevisionRequested && (
        <Card className="p-4 border-amber-500/40 bg-amber-50/50">
          <div className="flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-amber-900">Revision requested</h2>
              <p className="text-sm text-amber-900/80 mt-1">
                Your previous submission was returned for changes. Please re-record below.
              </p>
              {submission?.review_notes && (
                <p className="text-sm mt-2 p-2 bg-white rounded border border-amber-200 whitespace-pre-wrap">
                  {submission.review_notes}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
      <Card className="p-6 text-center">
        <Video className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-bold">Ready to record?</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Make sure your phone is in landscape mode, the lighting is good, and you have a stable view of the entire performance area. You will get two attempts to record your routine for final submission.
        </p>
        <Button asChild className="w-full h-12 text-base">
          <Link to={`/m/events/${eventId}/teams/${teamId}/record`}>Start Your Routine Recording</Link>
        </Button>
      </Card>
    </div>
  );
}
