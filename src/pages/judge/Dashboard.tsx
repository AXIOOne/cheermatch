import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Clock, CheckCircle, Play, Loader2, Calendar } from 'lucide-react';

export default function JudgeDashboard() {
  const { user } = useAuth();

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['judge-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          *,
          event:events(id, name, status, start_date, end_date, scoring_open_at),
          division:divisions(name),
          level:levels(name, level_number)
        `)
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['judge-scores', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('id, status')
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const completedScores = scores?.filter(s => s.status === 'submitted' || s.status === 'locked').length || 0;
  const inProgressScores = scores?.filter(s => s.status === 'in_progress').length || 0;

  const isLoading = assignmentsLoading || scoresLoading;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Judge Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your scoring overview.</p>
        </div>
        <Button asChild>
          <Link to="/judge/queue">
            <Play className="w-4 h-4 mr-2" />
            Start Scoring
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Events
            </CardTitle>
            <ClipboardCheck className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                [...new Set(assignments?.map(a => a.event_id))].length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : inProgressScores}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : completedScores}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Your Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-4">
              {[...assignments
                .reduce((map, assignment) => {
                  const event = assignment.event;
                  const eventId = assignment.event_id;
                  if (!map.has(eventId)) {
                    map.set(eventId, { event, assignments: [] });
                  }
                  map.get(eventId).assignments.push(assignment);
                  return map;
                }, new Map())
                .values()]
                .map(({ event, assignments: eventAssignments }: any) => {
                  const status = event?.status;
                  const isOpen = status === 'open_for_capture' || status === 'open_for_scoring';
                  const statusLabel =
                    status === 'open_for_capture' ? 'Open for capture' :
                    status === 'open_for_scoring' ? 'Open for scoring' :
                    status === 'in_progress' ? 'In progress' :
                    'Not yet released';
                  const statusClass =
                    status === 'open_for_capture' ? 'bg-blue-100 text-blue-700' :
                    status === 'open_for_scoring' ? 'bg-green-100 text-green-700' :
                    status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600';
                  const scoringOpenAt = event?.scoring_open_at
                    ? new Date(event.scoring_open_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : null;
                  return (
                    <div
                      key={event?.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div>
                        <h3 className="font-medium">{event?.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {scoringOpenAt ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Scoring opens {scoringOpenAt}
                            </span>
                          ) : (
                            <span>Scoring date TBD</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                        <Button size="sm" variant="outline" asChild={isOpen} disabled={!isOpen}>
                          {isOpen ? (
                            <Link to={`/judge/queue?event=${event?.id}`}>Score</Link>
                          ) : (
                            <span>Score</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No assignments yet.</p>
              <p className="text-sm mt-1">You'll see events here once an admin assigns you.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
