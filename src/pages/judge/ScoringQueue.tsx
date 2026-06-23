import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, Video, Loader2 } from 'lucide-react';

export default function ScoringQueue() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const eventFilter = searchParams.get('event');
  const [selectedEvent, setSelectedEvent] = useState<string>(eventFilter || 'all');

  // Get judge's section-level assignments (event_id + division_id)
  const { data: assignments } = useQuery({
    queryKey: ['judge-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          event_id,
          division_id,
          event:events(id, name, status)
        `)
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Build event_id → Set<division_id> for filtering submissions
  const eventDivisionMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (assignments || []).forEach((a: any) => {
      if (!a.event_id) return;
      const set = m.get(a.event_id) || new Set<string>();
      if (a.division_id) set.add(a.division_id);
      m.set(a.event_id, set);
    });
    return m;
  }, [assignments]);

  // Only allow scoring for events the admin has released
  const OPEN_STATUSES = new Set(['open_for_scoring', 'in_progress']);
  const openEventIds = useMemo(() => {
    const ids = new Set<string>();
    (assignments || []).forEach((a: any) => {
      if (a.event_id && OPEN_STATUSES.has(a.event?.status)) ids.add(a.event_id);
    });
    return ids;
  }, [assignments]);

  const assignedEventIds = useMemo(
    () => [...eventDivisionMap.keys()].filter((id) => openEventIds.has(id)),
    [eventDivisionMap, openEventIds]
  );

  // Get submissions for assigned events whose team's division is in the judge's assignments
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['judge-submissions', user?.id, selectedEvent, assignedEventIds.join(',')],
    queryFn: async () => {
      if (assignedEventIds.length === 0) return [];

      let query = supabase
        .from('video_submissions')
        .select(`
          *,
          team:teams(
            id, name, gym_name, athlete_count, division_id,
            division:divisions(id, name),
            level:levels(name, level_number)
          ),
          event:events(id, name)
        `)
        .in('event_id', assignedEventIds)
        .in('status', ['assigned', 'complete'])
        .order('created_at', { ascending: true });

      if (selectedEvent && selectedEvent !== 'all') {
        query = query.eq('event_id', selectedEvent);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((sub: any) => {
        const allowedDivs = eventDivisionMap.get(sub.event_id);
        if (!allowedDivs || allowedDivs.size === 0) return false;
        return sub.team?.division_id && allowedDivs.has(sub.team.division_id);
      });
    },
    enabled: !!user && !!assignments,
  });

  // Get existing scores by this judge
  const { data: existingScores } = useQuery({
    queryKey: ['judge-existing-scores', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('submission_id, status')
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getScoreStatus = (submissionId: string) => {
    const score = existingScores?.find(s => s.submission_id === submissionId);
    return score?.status || null;
  };

  const uniqueEvents = [...new Map(assignments?.map((a: any) => [a.event_id, a.event]) || [])];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Queue</h1>
          <p className="text-muted-foreground mt-1">Review and score team performances</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {uniqueEvents.map(([eventId, event]) => (
                <SelectItem key={eventId} value={eventId}>
                  {event?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions && submissions.length > 0 ? (
        <div className="grid gap-4">
          {submissions.map((submission) => {
            const scoreStatus = getScoreStatus(submission.id);
            return (
              <Card key={submission.id} className="overflow-hidden">
                <div className="flex">
                  {/* Thumbnail */}
                  <div className="w-48 h-32 bg-muted flex items-center justify-center shrink-0">
                    {submission.thumbnail_url ? (
                      <img 
                        src={submission.thumbnail_url} 
                        alt="Video thumbnail" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-10 h-10 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{submission.team?.name}</h3>
                        {scoreStatus === 'submitted' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Scored
                          </Badge>
                        )}
                        {scoreStatus === 'in_progress' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3 mr-1" />
                            In Progress
                          </Badge>
                        )}
                        {scoreStatus === 'locked' && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">{submission.team?.gym_name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{submission.event?.name}</span>
                        <span>•</span>
                        <span>{submission.team?.division?.name}</span>
                        <span>•</span>
                        <span>Level {submission.team?.level?.level_number}</span>
                        <span>•</span>
                        <span>{submission.team?.athlete_count} athletes</span>
                      </div>
                    </div>

                    <Button asChild>
                      <Link to={`/judge/score/${submission.id}`}>
                        <Play className="w-4 h-4 mr-2" />
                        {scoreStatus === 'in_progress' ? 'Continue' : scoreStatus === 'submitted' ? 'View' : 'Score'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No submissions available to score yet.</p>
            <p className="text-sm mt-1">Submissions appear here once an admin assigns you and releases the event for scoring.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
