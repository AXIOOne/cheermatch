import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Calendar, Activity, Plus, Loader2, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const { data: currentEvents, isLoading: currentLoading } = useQuery({
    queryKey: ['current-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, start_date, end_date, status')
        .in('status', ['open_for_capture', 'open_for_scoring'])
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: upcomingEvents, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, start_date, end_date, status')
        .eq('status', 'registration_open')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
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
      const roleMap = new Map<string, string[]>();
      if (userIds.length) {
        const [{ data: profs }, { data: roleRows }] = await Promise.all([
          supabase.from('profiles').select('user_id, avatar_url').in('user_id', userIds),
          supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
        ]);
        avatarMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.avatar_url]));
        (roleRows ?? []).forEach((r: any) => {
          roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
        });
      }
      return (data ?? []).map((d) => ({
        ...d,
        avatar_url: avatarMap.get(d.user_id) ?? null,
        roles: roleMap.get(d.user_id) ?? [],
      }));
    },
  });

  const { data: onlineUsers, isLoading: onlineLoading } = useQuery({
    queryKey: ['currently-online'],
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, avatar_url, last_seen_at')
        .gte('last_seen_at', since)
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const isLoading = onlineLoading;

  const fmtRange = (s: string, e: string) => {
    const so = new Date(s + 'T00:00:00');
    const eo = new Date(e + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return s === e
      ? so.toLocaleDateString(undefined, opts)
      : `${so.toLocaleDateString(undefined, opts)} – ${eo.toLocaleDateString(undefined, opts)}`;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to CheerMatch Admin</p>
        </div>
        <Button asChild>
          <Link to="/admin/events">
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="h-[320px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Current Events
            </CardTitle>
            <Activity className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="text-3xl font-bold">
              {currentLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : currentEvents?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Open for capture or scoring</p>
            <div className="mt-3 space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {(currentEvents ?? []).map((e) => (
                <Link
                  key={e.id}
                  to={`/admin/events/${e.id}`}
                  className="block rounded-md border p-2 hover:bg-muted/50"
                >
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtRange(e.start_date, e.end_date)} ·{' '}
                    {e.status === 'open_for_capture' ? 'Open for Capture' : 'Open for Scoring'}
                  </div>
                </Link>
              ))}
              {!currentLoading && (currentEvents ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No active events</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-[320px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Upcoming Events
            </CardTitle>
            <Calendar className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="text-3xl font-bold">
              {upcomingLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : upcomingEvents?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registration open</p>
            <div className="mt-3 space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {(upcomingEvents ?? []).map((e) => (
                <Link
                  key={e.id}
                  to={`/admin/events/${e.id}`}
                  className="block rounded-md border p-2 hover:bg-muted/50"
                >
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtRange(e.start_date, e.end_date)}</div>
                </Link>
              ))}
              {!upcomingLoading && (upcomingEvents ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              )}
            </div>
          </CardContent>
        </Card>


        <Card className="h-[320px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Currently Online
            </CardTitle>
            <div className="relative">
              <Activity className="w-5 h-5 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : onlineUsers?.length ?? 0}
            </div>
            <div className="mt-3 space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {(onlineUsers ?? []).map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 rounded-md border p-2"
                >
                  <Avatar className="h-7 w-7 border border-background">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name || u.email || ''} />}
                    <AvatarFallback className="text-[10px]">{initialsOf(u.full_name, u.email)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">
                    {u.full_name || u.email || 'Unknown user'}
                  </span>
                </div>
              ))}
              {!isLoading && (onlineUsers ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No users currently online</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {login.roles.length > 0 ? (
                        login.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                            {r.replace('_', ' ')}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No role</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground w-28 text-right" title={new Date(login.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(login.created_at), { addSuffix: true })}
                    </span>
                  </div>
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
