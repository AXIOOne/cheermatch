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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, Inbox, CheckCircle, XCircle, UserCheck, Flag, Search, ExternalLink, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { GenerateReviewLink } from '@/components/admin/GenerateReviewLink';
import { BulkEmailDialog } from '@/components/admin/BulkEmailDialog';
import type { Database } from '@/integrations/supabase/types';

type SubmissionStatus = Database['public']['Enums']['submission_status'];

// Lifecycle statuses we surface in the UI.
type LifecycleStatus = 'imported' | 'approved' | 'denied' | 'assigned' | 'complete';
const LIFECYCLE_STATUSES: LifecycleStatus[] = ['imported', 'approved', 'denied', 'assigned', 'complete'];

interface SubmissionWithDetails {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  created_at: string;
  duration_seconds: number | null;
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
  assigned: { label: 'Assigned', icon: UserCheck, className: 'bg-blue-100 text-blue-700' },
  complete: { label: 'Complete', icon: Flag, className: 'bg-primary/10 text-primary' },
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['admin-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          id,
          video_url,
          thumbnail_url,
          status,
          submitted_at,
          created_at,
          duration_seconds,
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LifecycleStatus }) => {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status: status as SubmissionStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      toast({ title: 'Status updated' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const filteredSubmissions = submissions?.filter((submission) => {
    const lifecycle = toLifecycle(submission.status);
    const matchesSearch =
      searchQuery === '' ||
      submission.team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.team.gym_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lifecycle === statusFilter;
    const matchesEvent = eventFilter === 'all' || submission.event.id === eventFilter;

    return matchesSearch && matchesStatus && matchesEvent;
  });

  const countBy = (status: LifecycleStatus) =>
    submissions?.filter((s) => toLifecycle(s.status) === status).length || 0;

  const stats = {
    total: submissions?.length || 0,
    imported: countBy('imported'),
    approved: countBy('approved'),
    assigned: countBy('assigned'),
    complete: countBy('complete'),
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

  const selectedSubmissions = submissions?.filter(s => selectedIds.has(s.id)).map(s => ({
    id: s.id,
    teamName: s.team.name,
    gymName: s.team.gym_name,
    eventId: s.event.id,
    eventName: s.event.name,
  })) || [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Video Submissions</h1>
        <p className="text-muted-foreground mt-1">Review, approve, and track team video submissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{stats.assigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{stats.complete}</p>
          </CardContent>
        </Card>
      </div>

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
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by event" />
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

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium">
                  {selectedIds.size} team{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button size="sm" onClick={() => setBulkEmailOpen(true)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Review Links
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSubmissions && filteredSubmissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedIds.has(s.id))}
                      onCheckedChange={toggleAllFiltered}
                    />
                  </TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Division / Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => {
                  const lifecycle = toLifecycle(submission.status);
                  const cfg = lifecycleConfig[lifecycle];
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow
                      key={submission.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(submission.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => navigate(`/admin/submissions/${submission.id}`)}
                    >
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(submission.id)}
                          onCheckedChange={() => toggleSelection(submission.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {submission.thumbnail_url ? (
                            <img
                              src={submission.thumbnail_url}
                              alt="Thumbnail"
                              className="w-16 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                              <Video className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{submission.team.name}</p>
                            <p className="text-sm text-muted-foreground">{submission.team.gym_name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{submission.event.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{submission.team.division.name}</p>
                          <p className="text-muted-foreground">{submission.team.level.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${cfg.className} border-0`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.submitted_at
                          ? format(new Date(submission.submitted_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {lifecycle === 'imported' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateStatusMutation.mutate({ id: submission.id, status: 'approved' })}
                                disabled={updateStatusMutation.isPending}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateStatusMutation.mutate({ id: submission.id, status: 'denied' })}
                                disabled={updateStatusMutation.isPending}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Deny
                              </Button>
                            </>
                          )}
                          {lifecycle === 'denied' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: submission.id, status: 'approved' })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Re-approve
                            </Button>
                          )}
                          {submission.video_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={submission.video_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          <GenerateReviewLink submissionId={submission.id} teamName={submission.team.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found.</p>
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
    </div>
  );
}
