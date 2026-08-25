import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Users, Video, Clapperboard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mobileApi } from "@/lib/mobile-api";
import { attemptKey, listAttempts } from "@/lib/capture-attempts";
import { toast } from "sonner";

type Team = {
  team_id: string; team_name: string; gym_name: string;
  athletes_female: string; athletes_male: string;
  division_name: string; level_name: string;
  submission: null | {
    id: string; status: string; video_url: string; thumbnail_url: string;
    brightcove_video_id: string; duration_seconds: string;
    submitted_at: string; captured_at: string; submitted_via: string;
  };
};

const statusLabel = (s: string) => ({
  draft: "Draft", pending: "Pending review", approved: "Submitted",
  assigned: "Assigned to judges", complete: "Scored", rejected: "Rejected",
  submitted: "Submitted",
} as Record<string, string>)[s] ?? s;

export default function MobileEventTeams() {
  const { eventId = "" } = useParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptsByTeam, setAttemptsByTeam] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.teams(eventId);
        if (!res.status) { toast.error(res.message); return; }
        setTeams((res.data as unknown as Team[]) ?? []);
      } finally { setLoading(false); }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!teams.length) return;
    let cancelled = false;
    (async () => {
      const counts: Record<string, number> = {};
      // Portal ledger is authoritative; fall back to the local ledger when offline.
      try {
        const res = await mobileApi.listAttempts(eventId);
        if (res.status && Array.isArray(res.data)) {
          for (const a of res.data) {
            counts[a.team_id] = Math.max(counts[a.team_id] ?? 0, Number(a.attempt_number) || 0);
          }
        }
      } catch { /* offline */ }
      await Promise.all(
        teams.map(async (t) => {
          const stored = await listAttempts(attemptKey(eventId, t.team_id));
          counts[t.team_id] = Math.max(counts[t.team_id] ?? 0, stored.length);
        }),
      );
      if (!cancelled) setAttemptsByTeam(counts);
    })();
    return () => { cancelled = true; };
  }, [eventId, teams]);


  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Your Teams</h1>
        <p className="text-sm text-muted-foreground">Tap the Team name below to record and submit their performance for Scoring.</p>
      </div>

      {loading && <div className="text-muted-foreground text-sm">Loading teams…</div>}
      {!loading && teams.length === 0 && (
        <Card className="p-6 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">No teams in this event yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Contact your event administrator to register a team.
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {teams.map((t) => {
          const attemptCount = attemptsByTeam[t.team_id] ?? 0;
          return (
            <Link key={t.team_id} to={`/m/events/${eventId}/teams/${t.team_id}`}>
              <Card className="p-4 active:bg-muted transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="font-semibold truncate">{t.team_name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate pl-6">{t.gym_name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                      <Badge variant="outline">{t.division_name}</Badge>
                      <Badge variant="outline">{t.level_name}</Badge>
                      <Badge variant="outline">{Number(t.athletes_female || 0) + Number(t.athletes_male || 0)} athletes ({Number(t.athletes_female || 0)}F / {Number(t.athletes_male || 0)}M)</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-2">
                      <div className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        {t.submission
                          ? <span className="text-primary font-medium">{statusLabel(t.submission.status)}</span>
                          : <span className="text-muted-foreground">No video submitted</span>}
                      </div>
                      {attemptCount > 0 && !t.submission && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Clapperboard className="h-3 w-3" />
                          <span className="font-medium">{attemptCount} attempt{attemptCount === 1 ? "" : "s"} recorded</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
