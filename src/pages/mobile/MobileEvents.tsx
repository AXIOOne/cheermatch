import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CalendarDays, ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mobileApi } from "@/lib/mobile-api";
import { toast } from "sonner";
import MobileHeader from "@/components/mobile/MobileHeader";

type EventRow = {
  id: string; description: string; long_description: string;
  start_date: string; end_date: string; sub_deadline: string;
  competition_status: string; event_uuid: string;
};

export default function MobileEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.events();
        if (!res.status) { toast.error(res.message); return; }
        setEvents((res.data as unknown as EventRow[]) ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      <MobileHeader />
      <div>
        <h1 className="text-2xl font-bold">Your Events</h1>
        <p className="text-sm text-muted-foreground">Pick an event to view your teams and submit videos.</p>
      </div>

      {loading && <div className="text-muted-foreground text-sm">Loading events…</div>}
      {!loading && events.length === 0 && (
        <Card className="p-6 text-center">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">No events assigned</div>
          <div className="text-sm text-muted-foreground mt-1">
            Once an administrator adds your team to an event, it will appear here.
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {events.map((e) => (
          <Link key={e.id} to={`/m/events/${e.id}`}>
            <Card className="p-4 active:bg-muted transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold min-w-0">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{e.description}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {e.start_date} → {e.end_date}
                  </div>
                  {e.sub_deadline && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Submission deadline: {e.sub_deadline}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={e.competition_status === "OPEN" ? "default" : "secondary"}>
                      {e.competition_status}
                    </Badge>
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
