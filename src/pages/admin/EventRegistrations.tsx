import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Search, Loader2, Users, Plus, Pencil, Upload, Trash2 } from 'lucide-react';
import { AddTeamDialog } from '@/components/admin/AddTeamDialog';
import { MultiAddTeamsDialog } from '@/components/admin/MultiAddTeamsDialog';
import { EditRegistrationDialog } from '@/components/admin/EditRegistrationDialog';
import { BulkImportTeamsDialog } from '@/components/admin/BulkImportTeamsDialog';
import { CoachAccountsPanel } from '@/components/admin/CoachAccountsPanel';
import { registrationVideoProgress } from '@/lib/registration-video-progress';

const videoStatusLabel: Record<string, string> = {
  not_started: 'Not started',
  capture_started: 'Capture started',
  pending: 'Pending',
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Ready for Review',
  imported: 'Imported',
  approved: 'Approved',
  denied: 'Denied',
  assigned: 'Assigned to Judges',
  complete: 'Scored',
  revision_requested: 'Revision Requested',
  failed: 'Failed',
};

export default function EventRegistrations() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [deleteTeam, setDeleteTeam] = useState<any>(null);
  const queryClient = useQueryClient();

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

  // Video submissions for this event, so the delete confirmation can warn when a submission is kept
  // and the table can show each team's video status
  const { data: eventSubmissions, isLoading: submissionsLoading, isError: submissionsError } = useQuery({
    queryKey: ['event-teams-submissions', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('video_submissions')
        .select('id, team_id, status, created_at, archived_at, video_url, brightcove_video_id')
        .eq('event_id', eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
    refetchInterval: 15000,
  });

  const { data: captureAttempts, isLoading: attemptsLoading, isError: attemptsError } = useQuery({
    queryKey: ['event-registration-capture-attempts', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('capture_attempts')
        .select('team_id, voided_at')
        .eq('event_id', eventId)
        .is('voided_at', null);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
    refetchInterval: 15000,
  });

  const submissionCountByTeam = useMemo(() => {
    const map = new Map<string, number>();
    (eventSubmissions ?? []).forEach((s) => {
      if (s.team_id) map.set(s.team_id, (map.get(s.team_id) ?? 0) + 1);
    });
    return map;
  }, [eventSubmissions]);

  const videoStatusByTeam = useMemo(() => new Map((teams ?? []).map(team => [
    team.id, registrationVideoProgress(team.id, eventSubmissions ?? [], captureAttempts ?? []),
  ])), [teams, eventSubmissions, captureAttempts]);

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] });
      setDeleteTeam(null);
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

  const isLoading = eventLoading || teamsLoading || submissionsLoading || attemptsLoading;
  const videoStatusUnavailable = submissionsError || attemptsError;

  return (
    <div className="p-4 sm:p-6 lg:p-8 font-body">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-heading font-bold text-foreground break-words">
              {eventLoading ? 'Loading...' : event?.name}
            </h1>
            <p className="text-muted-foreground mt-1">Team Registrations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={() => setMultiOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Multiple
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Registration
            </Button>
          </div>
        </div>
      </div>


      <section aria-labelledby="registered-teams-heading" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="registered-teams-heading" className="font-heading text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Registered Teams ({teams?.length || 0})
          </h2>
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by team or gym name..."
              aria-label="Search registered teams"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {videoStatusUnavailable && <p role="alert" className="mb-3 text-sm text-destructive">Video status could not be loaded. Please refresh to try again.</p>}
        <div className="rounded-md border overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeams.length > 0 ? (
            <Table aria-label="Registered teams" className="min-w-[860px] [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:h-9">
              <TableHeader className="bg-muted text-xs">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Video Status</TableHead>
                  <TableHead className="text-right">Athletes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team, index) => (
                  <TableRow key={team.id} className="registration-row" data-video-stage={videoStatusUnavailable ? undefined : videoStatusByTeam.get(team.id)?.stage}>
                    <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <div>{team.name || team.gym_name}</div>
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
                    <TableCell>{team.division?.name || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{team.level?.name || '—'}</TableCell>
                    <TableCell>
                      {(() => {
                        const progress = videoStatusByTeam.get(team.id);
                        if (videoStatusUnavailable || !progress) return <span className="text-muted-foreground">Unavailable</span>;
                        const label = videoStatusLabel[progress.status] ?? progress.status;
                        return (
                          <Badge variant="outline" className="bg-background/60 border-border/60 font-medium whitespace-nowrap">
                            {label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{(team.athletes_female || 0) + (team.athletes_male || 0)} <span className="text-xs text-muted-foreground">({team.athletes_female || 0}F / {team.athletes_male || 0}M)</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${team.name || team.gym_name}`} title="Edit registration" onClick={() => setEditTeam(team)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground/60 hover:text-destructive"
                          aria-label={`Delete ${team.name || team.gym_name}`}
                          title="Delete registration"
                          onClick={() => setDeleteTeam(team)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
        </div>
      </section>

      {eventId && <CoachAccountsPanel eventId={eventId} />}

      {eventId && (
        <AddTeamDialog open={addOpen} onOpenChange={setAddOpen} eventId={eventId} />
      )}
      {eventId && (
        <MultiAddTeamsDialog open={multiOpen} onOpenChange={setMultiOpen} eventId={eventId} />
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

      <AlertDialog open={!!deleteTeam} onOpenChange={(o) => !o && setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete registration?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTeam && (submissionCountByTeam.get(deleteTeam.id) ?? 0) > 0
                ? `"${deleteTeam.name}" has a video submission. The registration will be deleted, but the video submission will be kept and unlinked from any registration.`
                : `This will permanently delete the registration for "${deleteTeam?.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTeam && deleteMutation.mutate(deleteTeam.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
