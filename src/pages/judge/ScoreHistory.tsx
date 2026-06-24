import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { History, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';

export default function ScoreHistory() {
  const { user } = useAuth();

  const { data: scores, isLoading } = useQuery({
    queryKey: ['judge-score-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          submission:video_submissions(
            id,
            team:teams(name, gym_name)
          ),
          template:scoring_templates(name)
        `)
        .eq('judge_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const statusColors: Record<string, string> = {
    in_progress: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-green-100 text-green-700',
    locked: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Score History</h1>
        <p className="text-muted-foreground mt-1">View all your submitted scores</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : scores && scores.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((score) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">
                      {score.submission?.team?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{score.submission?.team?.gym_name || '-'}</TableCell>
                    <TableCell>{score.template?.name || '-'}</TableCell>
                    <TableCell>
                      <span className="font-bold text-primary">
                        {score.total_score != null ? `${score.total_score.toFixed(2)}%` : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[score.status] || ''}>
                        {score.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {score.submitted_at 
                        ? format(new Date(score.submitted_at), 'MMM d, yyyy h:mm a')
                        : format(new Date(score.created_at), 'MMM d, yyyy')
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/judge/score/${score.submission_id}`}>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scores yet.</p>
              <p className="text-sm mt-1">Your submitted scores will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
