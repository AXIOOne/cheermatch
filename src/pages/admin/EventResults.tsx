import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Trophy, Download, Medal } from 'lucide-react';

export default function EventResults() {
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

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['event-results', eventId],
    queryFn: async () => {
      // Get all submissions with their scores, grouped by team
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          id,
          team:teams(
            id, 
            name, 
            gym_name,
            division:divisions(id, name),
            level:levels(id, name)
          ),
          scores:scores(total_score, status)
        `)
        .eq('event_id', eventId);
      
      if (error) throw error;

      // Calculate average scores and sort by division/level
      const processedResults = data
        ?.map(submission => {
          const submittedScores = submission.scores?.filter((s: any) => s.status === 'submitted') || [];
          const avgScore = submittedScores.length > 0
            ? submittedScores.reduce((sum: number, s: any) => sum + (s.total_score || 0), 0) / submittedScores.length
            : null;
          
          return {
            ...submission,
            avgScore,
            judgeCount: submittedScores.length,
          };
        })
        .filter(r => r.avgScore !== null)
        .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

      return processedResults;
    },
  });

  const isLoading = eventLoading || resultsLoading;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {eventLoading ? 'Loading...' : event?.name}
            </h1>
            <p className="text-muted-foreground mt-1">Competition Results</p>
          </div>
          <Button variant="outline" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Final Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : results && results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Average Score</TableHead>
                  <TableHead className="text-right">Judges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">
                      {getRankBadge(index + 1)}
                    </TableCell>
                    <TableCell className="font-medium">{result.team?.name || '—'}</TableCell>
                    <TableCell>{result.team?.gym_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{result.team?.division?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{result.team?.level?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {result.avgScore?.toFixed(2) || '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {result.judgeCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scored results available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
