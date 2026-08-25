import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, VideoOff, Inbox, CheckCircle, XCircle, Search, ExternalLink, Mail, RotateCcw, Archive, ArchiveRestore, Trash2, Download, Upload, Clapperboard, AlertTriangle, Play } from 'lucide-react';
import { downloadSubmissionVideo, VideoPreparingError } from '@/lib/download-submission-video';
import { useVideoPrep } from '@/hooks/useVideoPrep';
import { format } from 'date-fns';
import { GenerateReviewLink } from '@/components/admin/GenerateReviewLink';
import { BulkEmailDialog } from '@/components/admin/BulkEmailDialog';
import { DeleteSubmissionDialog } from '@/components/admin/DeleteSubmissionDialog';
import { ReplaceVideoDialog } from '@/components/admin/ReplaceVideoDialog';
import { useAuth } from '@/hooks/useAuth';
import VideoPlayer from '@/components/video/VideoPlayer';
import type { Database } from '@/integrations/supabase/types';

type SubmissionStatus = Database['public']['Enums']['submission_status'];

// Lifecycle statuses we surface in the UI.
type LifecycleStatus = 'imported' | 'approved' | 'denied' | 'revision_requested';
const LIFECYCLE_STATUSES: LifecycleStatus[] = ['imported', 'approved', 'denied', 'revision_requested'];

interface SubmissionWithDetails {
  id: string;
  video_url: string | null;
  brightcove_video_id: string | null;
  thumbnail_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  archived_at: string | null;
  archived_by: string | null;
  status_before_archive: SubmissionStatus | null;
  team: {
    id: string;
    name: string;
    gym_name: string;
    division: { name: string };
    level: { name: string };
  };
  event: {
    id: string;
    name: string;
  };
}

const lifecycleConfig: Record<LifecycleStatus, { label: string; icon: React.ElementType; className: string }> = {
  imported: { label: 'Imported', icon: Inbox, className: 'bg-muted text-muted-foreground' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  denied: { label: 'Denied', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
  revision_requested: { label: 'Revision Requested', icon: RotateCcw, className: 'bg-amber-100 text-amber-700' },
};

// Map any legacy status onto the new lifecycle for display.
function toLifecycle(s: SubmissionStatus): LifecycleStatus {
  if ((LIFECYCLE_STATUSES as string[]).includes(s)) return s as LifecycleStatus;
  return 'imported';
}

export default function Submissions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [tab, setTab] = useState<'current' | 'archived' | 'pending'>('current');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<{ id: string; teamName: string }[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ id: string; teamName: string } | null>(null);
  const [videoModalSubmission, setVideoModalSubmission] = useState<SubmissionWithDetails | null>(null);

  const videoPrep = useVideoPrep();

  const handleDownload = async (submission: SubmissionWithDetails) => {
    setDownloadingId(submission.id);
    try {
      await downloadSubmissionVideo(submission.id, submission.video_url);
      videoPrep.clear(submission.id);
    } catch (e: any) {
      if (e instanceof VideoPreparingError) {
        videoPrep.markPreparing(submission.id);
        toast({ title: 'Preparing download', description: e.message });
      } else {
        toast({ variant: 'destructive', title: 'Download unavailable', description: e.message });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['admin-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          id,
          video_url,
          brightcove_video_id,
          thumbnail_url,
          status,
          submitted_at,
          created_at,
          duration_seconds,
          archived_at,
          archived_by,
          status_before_archive,
          team:teams!inner(
            id,
            name,
            gym_name,
            division:divisions!inner(name),
            level:levels!inner(name)
          ),
          event:events!inner(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SubmissionWithDetails[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ['events-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Capture attempts recorded in the portal (source of truth, not the device)
  const { data: attempts } = useQuery({
    queryKey: ['capture-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capture_attempts')
        .select('id, event_id, team_id, attempt_number, started_at, outcome, team:teams(id, name, gym_name, division:divisions(name), level:levels(name)), event:events(id, name)')
        .is('voided_at', null)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string; event_id: string; team_id: string; attempt_number: number;
        started_at: string; outcome: string;
        team: { id: string; name: string; gym_name: string; division: { name: string } | null; level: { name: string } | null } | null;
        event: { id: string; name: string } | null;
      }>;
    },
  });


  const archiveMutation = useMutation({

    mutationFn: async (ids: string[]) => {
      const targets = submissions?.filter((s) => ids.includes(s.id)) ?? [];
      for (const s of targets) {
        const { error } = await supabase
          .from('video_submissions')
          .update({
            archived_at: new Date().toISOString(),
            archived_by: (await supabase.auth.getUser()).data.user?.id ?? null,
            status_before_archive: s.status,
          } as never)
          .eq('id', s.id);
        if (error) throw error;
      }
      return targets.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      setSelectedIds(new Set());
      toast({ title: `${count} submission${count !== 1 ? 's' : ''} archived` });
    },
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = submissions?.filter((s) => ids.includes(s.id)) ?? [];
      for (const s of targets) {
        const { error } = await supabase
          .from('video_submissions')
          .update({
            archived_at: null,
            archived_by: null,
            status_before_archive: null,
            status: (s.status_before_archive ?? s.status) as SubmissionStatus,
          } as never)
          .eq('id', s.id);
        if (error) throw error;
      }
      return targets.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      setSelectedIds(new Set());
      toast({ title: `${count} submission${count !== 1 ? 's' : ''} restored` });
    },
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const isArchivedTab = tab === 'archived';
  const isPendingTab = tab === 'pending';
  const tabScoped = isPendingTab
    ? []
    : submissions?.filter((s) => (isArchivedTab ? !!s.archived_at : !s.archived_at));

  const filteredSubmissions = tabScoped?.filter((submission) => {
    const lifecycle = toLifecycle(submission.status);
    const matchesSearch =
      searchQuery === '' ||
      submission.team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.team.gym_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lifecycle === statusFilter;
    const matchesEvent = eventFilter === 'all' || submission.event.id === eventFilter;

    return matchesSearch && matchesStatus && matchesEvent;
  });

  const eventScoped = tabScoped?.filter(
    (s) => eventFilter === 'all' || s.event.id === eventFilter
  );

  const countBy = (status: LifecycleStatus) =>
    eventScoped?.filter((s) => toLifecycle(s.status) === status).length || 0;

  const stats = {
    total: eventScoped?.length || 0,
    imported: countBy('imported'),
    approved: countBy('approved'),
    denied: countBy('denied'),
    revision_requested: countBy('revision_requested'),
  };

  // attempts per (event, team), plus teams that recorded but never uploaded a submission
  const teamEventKey = (eventId: string, teamId: string) => `${eventId}::${teamId}`;
  const attemptsByTeam = new Map<string, { count: number; lastAt: string }>();
  (attempts ?? []).forEach((a) => {
    const key = teamEventKey(a.event_id, a.team_id);
    const cur = attemptsByTeam.get(key);
    attemptsByTeam.set(key, {
      count: (cur?.count ?? 0) + 1,
      lastAt: cur?.lastAt && cur.lastAt > a.started_at ? cur.lastAt : a.started_at,
    });
  });

  // A team is "awaiting video" for an event when it has attempts but no live submission there
  const submittedKeys = new Set(
    (submissions ?? []).filter((s) => !s.archived_at).map((s) => teamEventKey(s.event.id, s.team.id)),
  );

  type PendingCapture = {
    key: string; teamId: string; teamName: string; gymName: string;
    divisionName: string; levelName: string; eventId: string; eventName: string;
    count: number; lastAt: string;
  };

  const pendingCaptures: PendingCapture[] = Object.values(
    (attempts ?? [])
      .filter((a) => !submittedKeys.has(teamEventKey(a.event_id, a.team_id)))
      .reduce((acc, a) => {
        const key = teamEventKey(a.event_id, a.team_id);
        const cur = acc[key];
        acc[key] = {
          key,
          teamId: a.team_id,
          teamName: a.team?.name ?? 'Unknown team',
          gymName: a.team?.gym_name ?? '',
          divisionName: a.team?.division?.name ?? '—',
          levelName: a.team?.level?.name ?? '',
          eventId: a.event_id,
          eventName: a.event?.name ?? '',
          count: (cur?.count ?? 0) + 1,
          lastAt: cur?.lastAt && cur.lastAt > a.started_at ? cur.lastAt : a.started_at,
        };
        return acc;
      }, {} as Record<string, PendingCapture>),
  ).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  const filteredPending = !isPendingTab
    ? []
    : pendingCaptures.filter((p) => {
        const matchesEvent = eventFilter === 'all' || p.eventId === eventFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          q === '' || p.teamName.toLowerCase().includes(q) || p.gymName.toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all';
        return matchesEvent && matchesSearch && matchesStatus;
      });



  const archivedCount = submissions?.filter((s) => !!s.archived_at).length || 0;
  const currentCount = submissions?.filter((s) => !s.archived_at).length || 0;

  const switchTab = (value: string) => {
    setTab(value === 'archived' ? 'archived' : value === 'pending' ? 'pending' : 'current');
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (!filteredSubmissions) return;
    const allSelected = filteredSubmissions.every(s => selectedIds.has(s.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map(s => s.id)));
    }
  };

  const selectedRows = tabScoped?.filter(s => selectedIds.has(s.id)) || [];

  const selectedSubmissions = selectedRows.map(s => ({
    id: s.id,
    teamName: s.team.name,
    gymName: s.team.gym_name,
    eventId: s.event.id,
    eventName: s.event.name,
  }));

  const openDelete = (targets: { id: string; teamName: string }[]) => {
    setDeleteTargets(targets);
    setDeleteOpen(true);
  };


  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Video Submissions</h1>
          <p className="text-muted-foreground mt-1">Review, approve, and track team video submissions</p>
        </div>
        <div className="w-full md:w-[280px]">
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Event</label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events?.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={switchTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="current">Current ({currentCount})</TabsTrigger>
          <TabsTrigger value="pending">Awaiting video ({pendingCaptures.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedCount})</TabsTrigger>
        </TabsList>
      </Tabs>




      {/* Stats Cards */}
      {!isPendingTab && (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Imported</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">{stats.imported}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{stats.denied}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revisions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{stats.revision_requested}</p>
          </CardContent>
        </Card>
      </div>
      )}


      {/* Filters & Bulk Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by team or gym name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {LIFECYCLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{lifecycleConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 flex-wrap p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium">
                  {selectedIds.size} team{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                {!isArchivedTab && (
                  <>
                    <Button size="sm" onClick={() => setBulkEmailOpen(true)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Review Links
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setArchiveConfirmOpen(true)}>
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </Button>
                  </>
                )}
                {isArchivedTab && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setRestoreConfirmOpen(true)}>
                      <ArchiveRestore className="w-4 h-4 mr-2" />
                      Restore to Current
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDelete(selectedRows.map(s => ({ id: s.id, teamName: s.team.name })))}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete permanently
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isPendingTab && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500">
          <AlertTriangle className="w-4 h-4" />
          Teams that recorded capture attempts on the mobile app but haven't chosen a final video yet.
        </div>
      )}


      {/* Submissions Table */}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (filteredSubmissions && filteredSubmissions.length > 0) || filteredPending.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={!!filteredSubmissions?.length && filteredSubmissions.every(s => selectedIds.has(s.id))}
                      onCheckedChange={toggleAllFiltered}
                    />
                  </TableHead>
                  <TableHead className="min-w-[260px]">Team</TableHead>
                  <TableHead className="w-[220px]">Gym</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Division / Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>

                  <TableHead>{isArchivedTab ? 'Archived' : 'Submitted'}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredSubmissions ?? []).map((submission) => {
                  const lifecycle = toLifecycle(submission.status);
                  const cfg = lifecycleConfig[lifecycle];
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow
                      key={submission.id}
                      className={`group cursor-pointer text-sm hover:bg-muted/50 ${selectedIds.has(submission.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => navigate(`/admin/submissions/${submission.id}`)}
                    >
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(submission.id)}
                          onCheckedChange={() => toggleSelection(submission.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm font-semibold text-muted-foreground leading-tight whitespace-nowrap">{submission.team.name}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (submission.video_url) setVideoModalSubmission(submission);
                            }}
                            disabled={!submission.video_url}
                            className="h-10 aspect-video bg-muted rounded flex items-center justify-center cursor-pointer hover:bg-muted/80 disabled:cursor-default disabled:opacity-60 relative"
                            title={submission.video_url ? 'Play video' : 'No video available'}
                          >
                            <Video className="w-4 h-4 text-muted-foreground" />
                            {submission.video_url && <Play className="w-3 h-3 text-foreground absolute opacity-80" />}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground break-words max-w-[220px]">{submission.team.gym_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{submission.event.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>
                          <p className="text-sm text-muted-foreground leading-tight">{submission.team.division.name}</p>
                          <p className="text-sm text-muted-foreground leading-tight">{submission.team.level.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Badge variant="outline" className={`${cfg.className} border-0 text-sm font-medium text-muted-foreground`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(() => {
                          const att = attemptsByTeam.get(teamEventKey(submission.event.id, submission.team.id));
                          return att ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                              title={`Last attempt ${format(new Date(att.lastAt), 'MMM d, yyyy p')}`}
                            >
                              <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" />
                              {att.count}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          );
                        })()}
                      </TableCell>


                      <TableCell className="text-sm text-muted-foreground">
                        {isArchivedTab
                          ? submission.archived_at
                            ? format(new Date(submission.archived_at), 'MMM d, yyyy')
                            : '-'
                          : submission.submitted_at
                            ? format(new Date(submission.submitted_at), 'MMM d, yyyy')
                            : '-'}
                      </TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!isArchivedTab && (
                            <GenerateReviewLink
                              submissionId={submission.id}
                              teamName={submission.team.name}
                              variant="default"
                              size="sm"
                            />
                          )}

                          <div className="inline-flex items-center rounded-md border border-border bg-background divide-x divide-border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none text-muted-foreground hover:text-primary"
                              title={
                                videoPrep.getState(submission.id) === 'preparing'
                                  ? 'Preparing a downloadable copy on the host…'
                                  : videoPrep.getState(submission.id) === 'ready'
                                    ? 'Downloadable copy is ready'
                                    : submission.brightcove_video_id || submission.video_url
                                      ? 'Download video'
                                      : 'No video available'
                              }
                              disabled={(!submission.brightcove_video_id && !submission.video_url) || downloadingId === submission.id}
                              onClick={() => handleDownload(submission)}
                            >
                              {downloadingId === submission.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : videoPrep.getState(submission.id) === 'preparing' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              ) : videoPrep.getState(submission.id) === 'ready' ? (
                                <Download className="w-4 h-4 text-primary" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>

                            {isAdmin && !isArchivedTab && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-none text-muted-foreground hover:text-primary"
                                title="Replace video"
                                onClick={() => setReplaceTarget({ id: submission.id, teamName: submission.team.name })}
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                            )}

                            {submission.video_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-none text-muted-foreground hover:text-primary"
                                asChild
                              >
                                <a href={submission.video_url} target="_blank" rel="noopener noreferrer" title="Open video">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>

                          {!isArchivedTab && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              title="Archive submission"
                              onClick={() => {
                                setSelectedIds(new Set([submission.id]));
                                setArchiveConfirmOpen(true);
                              }}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}

                          {isArchivedTab && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                title="Restore to current"
                                onClick={() => {
                                  setSelectedIds(new Set([submission.id]));
                                  setRestoreConfirmOpen(true);
                                }}
                              >
                                <ArchiveRestore className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                  title="Delete permanently"
                                  onClick={() => openDelete([{ id: submission.id, teamName: submission.team.name }])}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredPending.map((p) => (
                  <TableRow key={p.key} className="text-sm bg-amber-50/40 dark:bg-amber-950/10">
                    <TableCell className="w-10" />
                    <TableCell className="text-sm text-muted-foreground align-top">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm font-semibold text-muted-foreground leading-tight whitespace-nowrap">{p.teamName}</p>
                        <div className="h-10 aspect-video rounded border border-dashed border-amber-400/70 bg-muted/50 flex items-center justify-center">
                          <VideoOff className="w-4 h-4 text-amber-600" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground break-words max-w-[220px]">{p.gymName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.eventName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>
                        <p className="text-sm text-muted-foreground leading-tight">{p.divisionName}</p>
                        <p className="text-sm text-muted-foreground leading-tight">{p.levelName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="bg-amber-100 text-muted-foreground border-0 text-sm font-medium">
                        <Clapperboard className="w-3 h-3 mr-1" />
                        No video selected
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      <span
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                        title={`Last attempt ${format(new Date(p.lastAt), 'MMM d, yyyy p')}`}
                      >
                        <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" />
                        {p.count}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Recorded {format(new Date(p.lastAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      Awaiting coach selection
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{isArchivedTab ? 'No archived submissions.' : isPendingTab ? 'No teams are awaiting a video selection.' : 'No submissions found.'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        submissions={selectedSubmissions}
      />

      {/* Archive confirmation */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {selectedIds.size} submission{selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived submissions are removed from the active list, judging queues and results, but their
              scores and videos are kept. You can restore them at any time from the Archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate(Array.from(selectedIds))}
              disabled={archiveMutation.isPending}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation */}
      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore {selectedIds.size} submission{selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will return to the Current tab with the status they had before being archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreMutation.mutate(Array.from(selectedIds))}
              disabled={restoreMutation.isPending}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete */}
      <ReplaceVideoDialog
        open={!!replaceTarget}
        onOpenChange={(o) => { if (!o) setReplaceTarget(null); }}
        submissionId={replaceTarget?.id ?? null}
        teamName={replaceTarget?.teamName}
        onReplaced={() => queryClient.invalidateQueries({ queryKey: ['admin-submissions'] })}
      />

      <DeleteSubmissionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        submissions={deleteTargets}
        onDeleted={() => setSelectedIds(new Set())}
      />

      <Dialog open={!!videoModalSubmission} onOpenChange={(o) => { if (!o) setVideoModalSubmission(null); }}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{videoModalSubmission?.team.name} — Performance Video</DialogTitle>
          </DialogHeader>
          {videoModalSubmission && (
            <VideoPlayer
              url={videoModalSubmission.video_url}
              thumbnailUrl={videoModalSubmission.thumbnail_url}
              status={videoModalSubmission.status}
              title={`${videoModalSubmission.team.name} performance video`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
