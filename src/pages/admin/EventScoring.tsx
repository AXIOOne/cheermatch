import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { downloadSubmissionScoresheet, generateSubmissionScoresheetBytes } from '@/lib/download-submission-scoresheet';
import { downloadPdf } from '@/lib/scoresheet-pdf';


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
  judge_user_id: string;
  needs_review?: boolean;
  reviewed_at?: string | null;
  review_reason?: string | null;
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
  const [confirmSendFor, setConfirmSendFor] = useState<{ id: string; teamName: string } | null>(null);
  const [previewFor, setPreviewFor] = useState<{ id: string; teamName: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('scoresheet.pdf');
  const [previewLoading, setPreviewLoading] = useState(false);
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
          scores:scores(id, status, total_score, panel_id, judge_user_id, needs_review, reviewed_at, review_reason)
        `)
        .eq('event_id', eventId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  // Map judge_user_id -> panel_id for this event so we can resolve scores whose
  // panel_id is null (older rows from before section assignments were panel-linked).
  const { data: judgePanelByUser } = useQuery({
    queryKey: ['event-judge-panel-map', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('judge_user_id, panel_id')
        .eq('event_id', eventId)
        .not('panel_id', 'is', null);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((a: any) => {
        if (a.judge_user_id && a.panel_id) map[a.judge_user_id] = a.panel_id;
      });
      return map;
    },
    enabled: !!eventId,
  });

  const resolveScorePanelId = (score: Score): string | null =>
    score.panel_id ?? judgePanelByUser?.[score.judge_user_id] ?? null;

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

  const handleConfirmSend = () => {
    if (!confirmSendFor) return;
    const id = confirmSendFor.id;
    setSendingScoreFor(id);
    setConfirmSendFor(null);
    sendScoreSheetMutation.mutate(id);
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

  // Generate preview PDF when previewFor changes
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    if (!previewFor) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewBytes(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewBytes(null);
    generateSubmissionScoresheetBytes(previewFor.id, { includeAllScores: true })
      .then(({ bytes, fileName }) => {
        if (cancelled) return;
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
        createdUrl = URL.createObjectURL(blob);
        setPreviewBytes(bytes);
        setPreviewFileName(fileName);
        setPreviewUrl(createdUrl);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast({ variant: 'destructive', title: 'Preview failed', description: err.message });
        setPreviewFor(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFor?.id]);


  const isLoading = eventLoading || panelsLoading || submissionsLoading;

  // Find the score for a submission belonging to a given panel, resolving by
  // judge_assignment when the score row has no panel_id of its own.
  const findScoreForPanel = (submission: Submission, panelId: string): Score | undefined =>
    submission.scores.find(s => resolveScorePanelId(s) === panelId);

  // Calculate stats
  const stats = {
    total: submissions?.length || 0,
    fullyScored: submissions?.filter(s => {
      if (!panels || panels.length === 0) return false;
      return panels.every(p => {
        const sc = findScoreForPanel(s, p.id);
        return sc?.status === 'submitted';
      });
    }).length || 0,
    needsReview: submissions?.filter(s =>
      s.scores.some(sc => sc.needs_review && !sc.reviewed_at)
    ).length || 0,
    pending: submissions?.filter(s => {
      if (!panels || panels.length === 0) return s.scores.length === 0;
      return !panels.every(p => {
        const sc = findScoreForPanel(s, p.id);
        return sc?.status === 'submitted';
      });
    }).length || 0,
  };

  // Get panel scoring status for a submission
  const getPanelStatus = (
    submission: Submission,
    panelId: string
  ): 'pending' | 'in_progress' | 'submitted' | 'needs_review' | 'reviewed' => {
    const score = findScoreForPanel(submission, panelId);
    if (!score) return 'pending';
    if (score.reviewed_at) return 'reviewed';
    if (score.needs_review) return 'needs_review';
    return score.status as 'pending' | 'in_progress' | 'submitted';
  };

  // Get overall scoring status text
  const getOverallStatus = (
    submission: Submission,
  ): { text: string; allComplete: boolean; allReviewed: boolean; needsReview: boolean; hasDraft: boolean } => {
    const needsReview = submission.scores.some(s => s.needs_review && !s.reviewed_at);
    const hasDraft = submission.scores.some(s => s.status === 'in_progress');
    if (!panels || panels.length === 0) {
      const hasSubmitted = submission.scores.some(s => s.status === 'submitted');
      const hasReviewed = hasSubmitted && submission.scores.every(s => s.status !== 'submitted' || s.reviewed_at);
      const text = needsReview ? 'NEEDS REVIEW' : hasReviewed ? 'REVIEWED' : hasSubmitted ? 'SCORED' : hasDraft ? 'DRAFT SAVED' : 'PENDING';
      return { text, allComplete: hasSubmitted, allReviewed: hasReviewed, needsReview, hasDraft };
    }

    const completedPanels = panels.filter(p => {
      const sc = findScoreForPanel(submission, p.id);
      return sc?.status === 'submitted';
    }).length;
    const reviewedPanels = panels.filter(p => {
      const sc = findScoreForPanel(submission, p.id);
      return sc?.status === 'submitted' && sc?.reviewed_at;
    }).length;

    const allComplete = completedPanels === panels.length;
    const allReviewed = allComplete && reviewedPanels === panels.length;
    if (needsReview) return { text: 'NEEDS REVIEW', allComplete, allReviewed, needsReview, hasDraft };
    if (allReviewed) return { text: 'REVIEWED', allComplete, allReviewed, needsReview, hasDraft };
    if (allComplete) return { text: 'COMPLETE', allComplete, allReviewed, needsReview, hasDraft };
    if (hasDraft) return { text: 'DRAFT SAVED', allComplete, allReviewed, needsReview, hasDraft };
    return { text: 'PENDING', allComplete, allReviewed, needsReview, hasDraft };
  };


  const StatusIndicator = ({
    status,
    onClick,
    label,
  }: {
    status: 'pending' | 'in_progress' | 'submitted' | 'needs_review' | 'reviewed';
    onClick?: () => void;
    label?: string;
  }) => {
    const colors = {
      pending: 'bg-destructive hover:bg-destructive/80',
      in_progress: 'bg-primary hover:bg-primary/80',
      submitted: 'bg-success hover:bg-success/80',
      needs_review: 'bg-warning hover:bg-warning/80',
      reviewed: 'bg-success hover:bg-success/80',
    };
    const titles = {
      pending: 'Not started — click to score',
      in_progress: 'Draft saved by judge (not submitted) — click to preview',
      submitted: 'Complete — click to view/edit',
      needs_review: 'Needs review — click to view/edit',
      reviewed: 'Reviewed — click to view/edit',
    };
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ? `${label}: ${titles[status]}` : titles[status]}
        title={titles[status]}
        className={`w-5 h-5 rounded-sm transition-colors cursor-pointer flex items-center justify-center text-success-foreground ${colors[status]}`}
      >
        {status === 'reviewed' && <CheckCircle className="w-3.5 h-3.5" />}
      </button>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-full">
                <AlertCircle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Review</p>
                <p className="text-2xl font-bold">{stats.needsReview}</p>
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
                <div className="w-4 h-4 rounded-sm bg-success flex items-center justify-center text-success-foreground">
                  <CheckCircle className="w-3 h-3" />
                </div>
                <span className="text-sm">Reviewed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-warning" />
                <span className="text-sm">Needs Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-primary" />
                <span className="text-sm">Draft Saved (Not Submitted)</span>
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
                            overallStatus.needsReview
                              ? 'bg-warning/10 text-warning border-warning/20'
                              : overallStatus.allReviewed
                              ? 'bg-success/10 text-success border-success/20'
                              : overallStatus.allComplete
                              ? 'bg-warning/10 text-warning border-warning/20'
                              : overallStatus.hasDraft
                              ? 'bg-primary/10 text-primary border-primary/20'
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
                            className="h-8 bg-success text-success-foreground hover:bg-success/90"
                            disabled={sendingScoreFor === submission.id || !overallStatus.allReviewed}
                            onClick={() =>
                              setConfirmSendFor({ id: submission.id, teamName: submission.team?.name || 'this team' })
                            }
                          >
                            {sendingScoreFor === submission.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 mr-1" />
                            )}
                            Send
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
                                onClick={() =>
                                  setPreviewFor({ id: submission.id, teamName: submission.team?.name || 'Team' })
                                }
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownloadPdf(submission.id)}
                                disabled={downloadingPdfFor === submission.id}
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

      {/* Confirm send score sheet */}
      <AlertDialog open={!!confirmSendFor} onOpenChange={(open) => !open && setConfirmSendFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send score sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately email the finalized score sheet to the coach for{' '}
              <strong>{confirmSendFor?.teamName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>
              <Send className="w-4 h-4 mr-2" /> Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scoresheet PDF preview */}
      <Dialog open={!!previewFor} onOpenChange={(open) => !open && setPreviewFor(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Scoresheet Preview — {previewFor?.teamName}</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[70vh] bg-muted rounded-md overflow-hidden flex items-center justify-center">
            {previewLoading || !previewUrl ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Generating preview…</span>
              </div>
            ) : (
              <iframe src={previewUrl} title="Scoresheet preview" className="w-full h-full bg-white" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFor(null)}>Close</Button>
            <Button
              disabled={!previewBytes}
              onClick={() => previewBytes && downloadPdf(previewBytes, previewFileName)}
            >
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
