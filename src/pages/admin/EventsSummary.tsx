import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar, Users, BarChart3, Clock, CheckCircle, FileText } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  registration_open: '#22c55e',
  registration_closed: '#eab308',
  in_progress: '#3b82f6',
  completed: '#a855f7',
  archived: '#9ca3af',
};

export default function EventsSummary() {
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          teams:teams(count),
          submissions:video_submissions(count)
        `)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: scores } = useQuery({
    queryKey: ['all-scores-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('id, status')
        .eq('status', 'submitted');
      if (error) throw error;
      return data;
    },
  });

  const isLoading = eventsLoading;

  // Calculate statistics
  const statusCounts = events?.reduce((acc: Record<string, number>, event) => {
    acc[event.status] = (acc[event.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: STATUS_COLORS[status] || '#6b7280',
  }));

  const getTeamsCount = (teams: any) => {
    if (Array.isArray(teams) && teams.length > 0 && teams[0]?.count !== undefined) {
      return teams[0].count;
    }
    return 0;
  };

  const getSubmissionsCount = (submissions: any) => {
    if (Array.isArray(submissions) && submissions.length > 0 && submissions[0]?.count !== undefined) {
      return submissions[0].count;
    }
    return 0;
  };

  const totalTeams = events?.reduce((sum, e) => sum + getTeamsCount(e.teams), 0) || 0;
  const totalSubmissions = events?.reduce((sum, e) => sum + getSubmissionsCount(e.submissions), 0) || 0;
  const totalScores = scores?.length || 0;

  // Upcoming events (start date in next 30 days)
  const today = new Date();
  const thirtyDaysOut = addDays(today, 30);

  const upcomingDeadlines = events
    ?.filter(e => {
      const startDate = new Date(e.start_date);
      return isAfter(startDate, today) && isBefore(startDate, thirtyDaysOut);
    })
    .slice(0, 5) || [];

  // Registration data for chart
  const registrationData = events
    ?.filter(e => e.status !== 'archived' && e.status !== 'draft')
    .slice(0, 8)
    .map(e => ({
      name: e.name.length > 15 ? e.name.substring(0, 15) + '...' : e.name,
      teams: getTeamsCount(e.teams),
      submissions: getSubmissionsCount(e.submissions),
    })) || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Events Summary Report</h1>
        <p className="text-muted-foreground mt-1">Overview of all events and metrics</p>
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
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold">{events?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Teams</p>
                    <p className="text-2xl font-bold">{totalTeams}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Submissions</p>
                    <p className="text-2xl font-bold">{totalSubmissions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scores Submitted</p>
                    <p className="text-2xl font-bold">{totalScores}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Events by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Events by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No events found
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registrations by Event */}
            <Card>
              <CardHeader>
                <CardTitle>Registrations by Event</CardTitle>
              </CardHeader>
              <CardContent>
                {registrationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={registrationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="teams" name="Teams" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="submissions" name="Submissions" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No active events
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Upcoming Events (Next 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length > 0 ? (
                <div className="space-y-4">
                  {upcomingDeadlines.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Link 
                          to={`/admin/events/${event.id}/registrations`}
                          className="font-medium text-primary hover:underline"
                        >
                          {event.name}
                        </Link>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Starts: {format(new Date(event.start_date), 'MMM d, yyyy')}</span>
                          {event.time_zone && <span>{event.time_zone}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">{getTeamsCount(event.teams)} teams</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No upcoming events in the next 30 days.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
