import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Loader2, Users, Plus, Pencil, Upload } from 'lucide-react';
import { AddTeamDialog } from '@/components/admin/AddTeamDialog';
import { EditRegistrationDialog } from '@/components/admin/EditRegistrationDialog';
import { BulkImportTeamsDialog } from '@/components/admin/BulkImportTeamsDialog';
import { CoachAccountsPanel } from '@/components/admin/CoachAccountsPanel';

export default function EventRegistrations() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);

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

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['event-teams', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          division:divisions(id, name),
          level:levels(id, name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchQuery) return teams;
    
    const query = searchQuery.toLowerCase();
    return teams.filter(team => 
      team.name.toLowerCase().includes(query) ||
      team.gym_name.toLowerCase().includes(query)
    );
  }, [teams, searchQuery]);

  const isLoading = eventLoading || teamsLoading;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {eventLoading ? 'Loading...' : event?.name}
            </h1>
            <p className="text-muted-foreground mt-1">Team Registrations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Registration
            </Button>
          </div>
        </div>
      </div>


      {/* Search */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by team or gym name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Registered Teams ({teams?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Athletes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">
                      <div>{team.name}</div>
                      {team.coach_name && (
                        team.coach_email ? (
                          <a
                            href={`#coach-${team.coach_email}`}
                            className="text-xs text-muted-foreground font-normal hover:text-primary hover:underline"
                          >
                            {team.coach_name}
                          </a>
                        ) : (
                          <div className="text-xs text-muted-foreground font-normal">
                            {team.coach_name}
                          </div>
                        )
                      )}
                    </TableCell>
                    <TableCell>{team.gym_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{team.division?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{team.level?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{(team.athletes_female || 0) + (team.athletes_male || 0)} <span className="text-muted-foreground">({team.athletes_female || 0}F / {team.athletes_male || 0}M)</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditTeam(team)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {searchQuery
                  ? 'No teams match your search.'
                  : 'No teams registered for this event yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {eventId && <CoachAccountsPanel eventId={eventId} />}

      {eventId && (
        <AddTeamDialog open={addOpen} onOpenChange={setAddOpen} eventId={eventId} />
      )}
      {eventId && (
        <BulkImportTeamsDialog open={importOpen} onOpenChange={setImportOpen} eventId={eventId} />
      )}
      {editTeam && (
        <EditRegistrationDialog
          open={!!editTeam}
          onOpenChange={(o) => !o && setEditTeam(null)}
          team={editTeam}
        />
      )}
    </div>
  );
}
