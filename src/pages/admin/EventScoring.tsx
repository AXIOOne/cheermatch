import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, BarChart3, CheckCircle, Clock, Settings, Send, AlertCircle, ClipboardList, Eye, Download, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AssignPanelsDialog from '@/components/admin/AssignPanelsDialog';
import SubmissionScoringDialog from '@/components/admin/SubmissionScoringDialog';
import { downloadSubmissionScoresheet } from '@/lib/download-submission-scoresheet';


interface JudgePanel {
  id: string;
  name: string;
  abbreviation: string;
  display_order: number;
}

interface Score {
  id: string;
  status: string;
  total_score: number | null;
  panel_id: string | null;
  needs_review?: boolean;
  reviewed_at?: string | null;
}

interface Submission {
  id: string;
  status: string;
  team: {
    id: string;
    name: string;
    gym_name: string;
    coach_user_id: string;
    division: { id: string; name: string } | null;
    level: { id: string; name: string } | null;
  } | null;
  scores: Score[];
}

export default function EventScoring() {
  const { eventId } = useParams<{ eventId: string }>();
  const [isPanelsDialogOpen, setIsPanelsDialogOpen] = useState(false);
  const [sendingScoreFor, setSendingScoreFor] = useState<string | null>(null);
  const [downloadingPdfFor, setDownloadingPdfFor] = useState<string | null>(null);
  const [scoringSubmissionId, setScoringSubmissionId] = useState<string | null>(null);
  const [scoringPanelId, setScoringPanelId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: panels, isLoading: panelsLoading } = useQuery({
    queryKey: ['judge-panels', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_panels')
        .select('*')
        .eq('event_id', eventId)
        .order('display_order');
      if (error) throw error;
      return data as JudgePanel[];
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['event-submissions-scoring', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          id,
          status,
          team:teams(
            id, 
            name, 
            gym_name,
            coach_user_id,
            division:divisions(id, name),
            level:levels(id, name)
          ),
          scores:scores(id, status, total_score, panel_id, needs_review, reviewed_at)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  const { data: coachProfiles } = useQuery({
    queryKey: ['coach-profiles', eventId],
    queryFn: async () => {
      if (!submissions) return {};
      const coachIds = [...new Set(submissions.map(s => s.team?.coach_user_id).filter(Boolean))];
      if (coachIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', coachIds);
      if (error) throw error;
      
      return data.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { email: string; full_name: string | null }>);
    },
    enabled: !!submissions && submissions.length > 0,
  });

  const sendScoreSheetMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await supabase.functions.invoke('send-scoresheet-email', {
        body: { submissionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Score sheet sent successfully!' });
      setSendingScoreFor(null);
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to send score sheet', 
        description: error.message 
      });
      setSendingScoreFor(null);
    },
  });

  const handleSendScoreSheet = (submissionId: string) => {
    setSendingScoreFor(submissionId);
    sendScoreSheetMutation.mutate(submissionId);
  };

  const handleDownloadPdf = async (submissionId: string) => {
    setDownloadingPdfFor(submissionId);
    try {
      await downloadSubmissionScoresheet(submissionId);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'PDF failed', description: err.message });
    } finally {
      setDownloadingPdfFor(null);
    }
  };

  const isLoading = eventLoading || panelsLoading || submissionsLoading;

  // Calculate stats
  const stats = {
    total: submissions?.length || 0,
    fullyScored: submissions?.filter(s => {
      if (!panels || panels.length === 0) return false;
      return panels.every(p => 
        s.scores.some(sc => sc.panel_id === p.id && sc.status === 'submitted')
      );
    }).length || 0,
    pending: submissions?.filter(s => {
      if (!panels || panels.length === 0) return s.scores.length === 0;
      return !panels.every(p => 
        s.scores.some(sc => sc.panel_id === p.id && sc.status === 'submitted')
      );
    }).length || 0,
  };

  // Get panel scoring status for a submission
  const getPanelStatus = (
    submission: Submission,
    panelId: string
  ): 'pending' | 'in_progress' | 'submitted' | 'needs_review' => {
    const score = submission.scores.find(s => s.panel_id === panelId);
    if (!score) return 'pending';
    if (score.needs_review) return 'needs_review';
    return score.status as 'pending' | 'in_progress' | 'submitted';
  };

  // Get overall scoring status text
  const getOverallStatus = (submission: Submission): { text: string; allComplete: boolean } => {
    if (!panels || panels.length === 0) {
      const hasSubmitted = submission.scores.some(s => s.status === 'submitted');
      return { text: hasSubmitted ? 'SCORED' : 'PENDING', allComplete: hasSubmitted };
    }
    
    const completedPanels = panels.filter(p => 
      submission.scores.some(s => s.panel_id === p.id && s.status === 'submitted')
    ).length;
    
    if (completedPanels === panels.length) {
      return { text: 'COMPLETE', allComplete: true };
    }
    return { text: 'PENDING', allComplete: false };
  };

  const StatusIndicator = ({
    status,
    onClick,
    label,
  }: {
    status: 'pending' | 'in_progress' | 'submitted' | 'needs_review';
    onClick?: () => void;
    label?: string;
  }) => {
    const colors = {
      pending: 'bg-destructive hover:bg-destructive/80',
      in_progress: 'bg-destructive hover:bg-destructive/80',
      submitted: 'bg-success hover:bg-success/80',
      needs_review: 'bg-warning hover:bg-warning/80',
    };
    const titles = {
      pending: 'Not started — click to score',
      in_progress: 'In progress — click to continue',
      submitted: 'Complete — click to view/edit',
      needs_review: 'Needs review — click to view/edit',
    };
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ? `${label}: ${titles[status]}` : titles[status]}
        title={titles[status]}
        className={`w-5 h-5 rounded-sm transition-colors cursor-pointer ${colors[status]}`}
      />
    );
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
              {eventLoading ? 'Loading...' : `Match: ${event?.name || 'Event'}`}
            </h1>
            <p className="text-muted-foreground mt-1">Scoring Control Panel</p>
          </div>
          <Dialog open={isPanelsDialogOpen} onOpenChange={setIsPanelsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Assign Panels
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Panels</DialogTitle>
              </DialogHeader>
              <AssignPanelsDialog
                eventId={eventId!}
                onClose={() => {
                  setIsPanelsDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['judge-panels', eventId] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-full">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fully Scored</p>
                <p className="text-2xl font-bold">{stats.fullyScored}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-full">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel Legend */}
      {panels && panels.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Status Legend:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-success" />
                <span className="text-sm">Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-warning" />
                <span className="text-sm">Needs Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-destructive" />
                <span className="text-sm">Not Started</span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                Click any panel cell to view and edit that judge's scoresheet.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Sub #</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Team Division</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                  {panels?.map((panel) => (
                    <TableHead key={panel.id} className="text-center w-12">
                      {panel.abbreviation}
                    </TableHead>
                  ))}

                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission, index) => {
                  const coach = submission.team?.coach_user_id 
                    ? coachProfiles?.[submission.team.coach_user_id] 
                    : null;
                  const overallStatus = getOverallStatus(submission);
                  
                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        {(index + 1).toString().padStart(4, '0')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {submission.team?.name || 'Unknown Team'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {submission.team?.gym_name || '—'}
                          </p>
                        </div>

                      </TableCell>
                      <TableCell>
                        {submission.team?.division?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {coach?.full_name || coach?.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            overallStatus.allComplete
                              ? 'bg-success/10 text-success border-success/20'
                              : 'bg-muted text-muted-foreground border-transparent'
                          }
                        >
                          {overallStatus.text}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              setScoringPanelId(null);
                              setScoringSubmissionId(submission.id);
                            }}
                          >
                            <ClipboardList className="w-3.5 h-3.5 mr-1" />
                            Score
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="More actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => handleSendScoreSheet(submission.id)}
                                disabled={sendingScoreFor === submission.id || !overallStatus.allComplete}
                              >
                                {sendingScoreFor === submission.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                Send Score Sheet
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/submissions/${submission.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Preview
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownloadPdf(submission.id)}
                                disabled={downloadingPdfFor === submission.id || !overallStatus.allComplete}
                              >
                                {downloadingPdfFor === submission.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4 mr-2" />
                                )}
                                Download PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>

                      {panels?.map((panel) => (
                        <TableCell key={panel.id} className="text-center">
                          <div className="flex justify-center">
                            <StatusIndicator
                              status={getPanelStatus(submission, panel.id)}
                              label={`${submission.team?.name || 'Team'} ${panel.abbreviation}`}
                              onClick={() => {
                                setScoringPanelId(panel.id);
                                setScoringSubmissionId(submission.id);
                              }}
                            />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions for this event yet.</p>
              {(!panels || panels.length === 0) && (
                <p className="mt-2 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Configure judge panels to track scoring progress.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Dialog */}
      <SubmissionScoringDialog
        open={!!scoringSubmissionId}
        onOpenChange={(open) => {
          if (!open) {
            setScoringSubmissionId(null);
            setScoringPanelId(null);
          }
        }}
        submissionId={scoringSubmissionId}
        eventId={eventId!}
        panels={panels || []}
        initialPanelId={scoringPanelId}
      />
    </div>
  );
}
