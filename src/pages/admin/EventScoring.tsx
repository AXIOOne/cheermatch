import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, BarChart3, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function EventScoring() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['event-submissions', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          *,
          team:teams(id, name, gym_name),
          scores:scores(id, status, total_score)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = eventLoading || submissionsLoading;

  // Calculate stats
  const stats = {
    total: submissions?.length || 0,
    scored: submissions?.filter(s => s.scores && s.scores.some((sc: any) => sc.status === 'submitted')).length || 0,
    pending: submissions?.filter(s => !s.scores || s.scores.length === 0 || s.scores.every((sc: any) => sc.status === 'in_progress')).length || 0,
  };

  const getSubmissionStatus = (submission: any) => {
    if (!submission.scores || submission.scores.length === 0) return 'pending';
    if (submission.scores.some((s: any) => s.status === 'submitted')) return 'scored';
    return 'in_progress';
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: any }> = {
    pending: { label: 'Pending', variant: 'outline', icon: Clock },
    in_progress: { label: 'In Progress', variant: 'secondary', icon: AlertCircle },
    scored: { label: 'Scored', variant: 'default', icon: CheckCircle },
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <h1 className="text-3xl font-bold text-foreground">
          {eventLoading ? 'Loading...' : event?.name}
        </h1>
        <p className="text-muted-foreground mt-1">Scoring Dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scored</p>
                <p className="text-2xl font-bold">{stats.scored}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Submission Status</TableHead>
                  <TableHead>Scoring Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => {
                  const scoringStatus = getSubmissionStatus(submission);
                  const config = statusConfig[scoringStatus];
                  const Icon = config.icon;
                  const avgScore = submission.scores && submission.scores.length > 0
                    ? submission.scores.reduce((sum: number, s: any) => sum + (s.total_score || 0), 0) / submission.scores.length
                    : null;

                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">{submission.team?.name || '—'}</TableCell>
                      <TableCell>{submission.team?.gym_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={submission.status === 'ready' ? 'default' : 'outline'}>
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {avgScore !== null ? avgScore.toFixed(2) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions for this event yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
