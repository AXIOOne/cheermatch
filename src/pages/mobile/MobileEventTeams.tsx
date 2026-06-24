import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Users, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mobileApi } from "@/lib/mobile-api";
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

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.teams(eventId);
        if (!res.status) { toast.error(res.message); return; }
        setTeams((res.data as unknown as Team[]) ?? []);
      } finally { setLoading(false); }
    })();
  }, [eventId]);

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Your Teams</h1>
        <p className="text-sm text-muted-foreground">Tap a team to record and submit their performance.</p>
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
        {teams.map((t) => (
          <Link key={t.team_id} to={`/m/events/${eventId}/teams/${t.team_id}`}>
            <Card className="p-4 active:bg-muted transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{t.team_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.gym_name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                    <Badge variant="outline">{t.division_name}</Badge>
                    <Badge variant="outline">{t.level_name}</Badge>
                    <Badge variant="outline">{t.athlete_count} athletes</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-2">
                    <Video className="h-3 w-3" />
                    {t.submission
                      ? <span className="text-primary font-medium">{statusLabel(t.submission.status)}</span>
                      : <span className="text-muted-foreground">No video submitted</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
