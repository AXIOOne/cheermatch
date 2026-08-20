import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, BarChart3, TrendingUp, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function EventReports() {
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

  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['event-scores-report', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          id,
          total_score,
          status,
          judge_user_id,
          submission:video_submissions!inner(
            id,
            event_id,
            team:teams(
              id,
              division:divisions(id, name),
              level:levels(id, name)
            )
          )
        `)
        .eq('submission.event_id', eventId)
        .is('submission.archived_at', null)
        .eq('status', 'submitted');
      
      if (error) throw error;
      return data;
    },
  });

  const isLoading = eventLoading || scoresLoading;

  // Calculate statistics
  const stats = {
    totalScores: scores?.length || 0,
    avgScore: scores && scores.length > 0 
      ? scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / scores.length 
      : 0,
    minScore: scores && scores.length > 0 
      ? Math.min(...scores.map(s => s.total_score || 0))
      : 0,
    maxScore: scores && scores.length > 0 
      ? Math.max(...scores.map(s => s.total_score || 0))
      : 0,
    uniqueJudges: new Set(scores?.map(s => s.judge_user_id)).size,
  };

  // Score distribution by range
  const scoreDistribution = [
    { range: '0-20', count: scores?.filter(s => (s.total_score || 0) <= 20).length || 0 },
    { range: '21-40', count: scores?.filter(s => (s.total_score || 0) > 20 && (s.total_score || 0) <= 40).length || 0 },
    { range: '41-60', count: scores?.filter(s => (s.total_score || 0) > 40 && (s.total_score || 0) <= 60).length || 0 },
    { range: '61-80', count: scores?.filter(s => (s.total_score || 0) > 60 && (s.total_score || 0) <= 80).length || 0 },
    { range: '81-100', count: scores?.filter(s => (s.total_score || 0) > 80).length || 0 },
  ];

  // Scores by division
  const scoresByDivision = scores?.reduce((acc: Record<string, { name: string; scores: number[]; }>, score) => {
    const divName = score.submission?.team?.division?.name || 'Unknown';
    if (!acc[divName]) {
      acc[divName] = { name: divName, scores: [] };
    }
    acc[divName].scores.push(score.total_score || 0);
    return acc;
  }, {}) || {};

  const divisionAverages = Object.values(scoresByDivision).map(div => ({
    name: div.name,
    average: div.scores.reduce((a, b) => a + b, 0) / div.scores.length,
  }));

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
        <p className="text-muted-foreground mt-1">Average Report & Analytics</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Scores</p>
                    <p className="text-2xl font-bold">{stats.totalScores}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg % Perfection</p>
                    <p className="text-2xl font-bold">{stats.avgScore.toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">% Perfection Range</p>
                    <p className="text-2xl font-bold">{stats.minScore.toFixed(0)}% - {stats.maxScore.toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Judges</p>
                    <p className="text-2xl font-bold">{stats.uniqueJudges}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>% Perfection Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.totalScores > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No score data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Average by Division */}
            <Card>
              <CardHeader>
                <CardTitle>Avg % Perfection by Division</CardTitle>
              </CardHeader>
              <CardContent>
                {divisionAverages.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={divisionAverages}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, average }) => `${name}: ${average.toFixed(1)}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="average"
                      >
                        {divisionAverages.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No division data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
