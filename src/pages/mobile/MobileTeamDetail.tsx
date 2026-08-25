import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, Clapperboard, Video, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import VideoPlayer from "@/components/video/VideoPlayer";
import { mobileApi } from "@/lib/mobile-api";
import { attemptKey, listAttempts } from "@/lib/capture-attempts";

type TakeInfo = { seq: number; url: string | null; durationSec: number };

const fmtDur = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

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
  screen_capture_cnt?: number;
} | null;

export default function MobileTeamDetail() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [ev, setEv] = useState<EventInfo>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [takes, setTakes] = useState<TakeInfo[]>([]);

  useEffect(() => {
    const urls: string[] = [];
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
            screen_capture_cnt: Number(e.screen_capture_cnt || 2),
          });
        }
        // Portal ledger is the source of truth for the count; local footage makes
        // previous takes reviewable so a final submission can be chosen.
        let serverSeqs: number[] = [];
        try {
          const attRes = await mobileApi.listAttempts(eventId, teamId);
          if (attRes.status && Array.isArray(attRes.data)) {
            serverSeqs = attRes.data.map((a) => Number(a.attempt_number)).filter((n) => n > 0);
          }
        } catch { /* offline */ }
        const stored = await listAttempts(attemptKey(eventId, teamId));
        const localBySeq = new Map(stored.map((s) => [s.seq, s]));
        const seqs = Array.from(new Set([...serverSeqs, ...stored.map((s) => s.seq)])).sort((a, b) => a - b);
        setAttemptCount(seqs.length);
        setTakes(
          seqs.map((seq) => {
            const s = localBySeq.get(seq);
            const url = s?.blob ? URL.createObjectURL(s.blob) : null;
            if (url) urls.push(url);
            return { seq, url, durationSec: s?.durationSec ?? 0 };
          }),
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
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
              <VideoPlayer
                url={submission.video_url}
                thumbnailUrl={submission.thumbnail_url}
                status={submission.status}
                title="Submitted performance video"
              />
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

  const maxAttempts = ev?.screen_capture_cnt ?? 2;

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
      {/* Attempt tracker */}
      <Card className={`p-4 ${attemptsUsed > 0 ? "border-amber-500/40 bg-amber-50/50" : ""}`}>
        <div className="flex gap-3 items-start">
          <Clapperboard className={`h-5 w-5 flex-shrink-0 mt-0.5 ${attemptsUsed > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold ${attemptsUsed > 0 ? "text-amber-900" : ""}`}>
              {attemptsUsed} of {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"} used
            </h2>
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: maxAttempts }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < attemptsUsed ? "bg-amber-500" : "bg-muted"}`}
                />
              ))}
            </div>
            <p className={`text-sm mt-2 ${attemptsUsed > 0 ? "text-amber-900/80" : "text-muted-foreground"}`}>
              {attemptsUsed > 0
                ? `Any started recording counts against your limit, even if it was not submitted. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`
                : `You get ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} to capture this routine.`}
            </p>
          </div>
        </div>
      </Card>

      {/* Review previous takes and pick a final submission */}
      {attemptsUsed > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ListVideo className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Previous takes</h2>
          </div>
          <div className="space-y-3">
            {takes.map((t) => (
              <div key={t.seq} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Take #{t.seq}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {t.url ? fmtDur(t.durationSec) : "Not on this device"}
                  </span>
                </div>
                {t.url ? (
                  <video src={t.url} controls playsInline className="w-full rounded bg-black aspect-video" />
                ) : (
                  <div className="w-full rounded bg-muted aspect-video flex items-center justify-center px-4 text-center">
                    <span className="text-xs text-muted-foreground">
                      This attempt was recorded on another device or was interrupted before it saved. It still counts toward your limit.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {playableTakes > 0 && (
            <Button asChild variant="secondary" className="w-full h-12 text-base">
              <Link to={`/m/events/${eventId}/teams/${teamId}/record?review=1`}>
                Choose Final Submission
              </Link>
            </Button>
          )}
        </Card>
      )}

      <Card className="p-6 text-center">
        <Video className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-bold">{attemptsUsed > 0 ? "Record another take?" : "Ready to record?"}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Make sure your phone is in landscape mode, the lighting is good, and you have a stable view of the entire performance area. You will get {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"} to record your routine for final submission.
        </p>
        <Button asChild className="w-full h-12 text-base" disabled={attemptsLeft === 0}>
          <Link to={`/m/events/${eventId}/teams/${teamId}/record`}>
            {attemptsUsed > 0 ? `Record Another Take (${attemptsLeft} left)` : "Start Your Routine Recording"}
          </Link>
        </Button>
        {attemptsLeft === 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            All attempts used — review your takes above and submit the best one.
          </p>
        )}
      </Card>
    </div>
  );
}
