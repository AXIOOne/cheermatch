import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, Users, Trophy, ClipboardList, Plus, Loader2, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('scoring_templates')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: recentEvents, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: recentLogins, isLoading: loginsLoading } = useQuery({
    queryKey: ['recent-logins'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('login_events')
        .select('id, user_id, email, full_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const userIds = Array.from(new Set((data ?? []).map((d) => d.user_id)));
      let avatarMap = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .in('user_id', userIds);
        avatarMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.avatar_url]));
      }
      return (data ?? []).map((d) => ({ ...d, avatar_url: avatarMap.get(d.user_id) ?? null }));
    },
  });

  const isLoading = eventsLoading || teamsLoading || templatesLoading;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to CheerMatch Admin</p>
        </div>
        <Button asChild>
          <Link to="/admin/events/new">
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <Calendar className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : events}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered Teams
            </CardTitle>
            <Users className="w-5 h-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : teams}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scoring Templates
            </CardTitle>
            <ClipboardList className="w-5 h-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : templates}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Competitions
            </CardTitle>
            <Trophy className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Events</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/events">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div>
                    <h3 className="font-medium">{event.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    event.status === 'draft' ? 'bg-muted text-muted-foreground' :
                    event.status === 'registration_open' ? 'bg-green-100 text-green-700' :
                    event.status === 'open_for_capture' ? 'bg-blue-100 text-blue-700' :
                    event.status === 'open_for_scoring' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {{
                      draft: 'Draft',
                      registration_open: 'Registration Open',
                      registration_closed: 'Registration Closed',
                      open_for_capture: 'Open for Capture',
                      open_for_scoring: 'Open for Scoring',
                      in_progress: 'In Progress',
                      completed: 'Completed',
                      archived: 'Archived',
                    }[event.status] ?? event.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No events yet. Create your first event to get started.</p>
              <Button className="mt-4" asChild>
                <Link to="/admin/events/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logins */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Recent Logins
            </CardTitle>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </div>
        </CardHeader>
        <CardContent>
          {loginsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentLogins && recentLogins.length > 0 ? (
            <div className="divide-y divide-border">
              {recentLogins.map((login) => (
                <div key={login.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {login.avatar_url && <AvatarImage src={login.avatar_url} alt={login.full_name || login.email || ''} />}
                      <AvatarFallback className="text-xs">{initialsOf(login.full_name, login.email)}</AvatarFallback>
                    </Avatar>
                    <div>
                    <p className="font-medium text-sm">
                      {login.full_name || login.email || 'Unknown user'}
                    </p>
                    {login.full_name && login.email && (
                      <p className="text-xs text-muted-foreground">{login.email}</p>
                    )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground" title={new Date(login.created_at).toLocaleString()}>
                    {formatDistanceToNow(new Date(login.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No logins recorded in the last 30 days.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
