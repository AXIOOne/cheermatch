import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, 
  Save, Send, Loader2, CheckCircle, Clock, AlertCircle,
  SkipBack, SkipForward, User
} from 'lucide-react';

interface JudgePanel {
  id: string;
  name: string;
  abbreviation: string;
  display_order: number;
}

interface CategoryScore {
  category_id: string;
  points: number;
  notes: string;
}

interface SubmissionScoringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  eventId: string;
  panels: JudgePanel[];
}

export default function SubmissionScoringDialog({
  open,
  onOpenChange,
  submissionId,
  eventId,
  panels,
}: SubmissionScoringDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [categoryScores, setCategoryScores] = useState<Record<string, CategoryScore>>({});
  const [deductions, setDeductions] = useState(0);
  const [comments, setComments] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Set default panel when panels load
  useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(panels[0].id);
    }
  }, [panels, selectedPanelId]);

  // Fetch submission details
  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['admin-submission-detail', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          *,
          team:teams(
            id, name, gym_name, athlete_count,
            division:divisions(name),
            level:levels(name, level_number)
          ),
          event:events(id, name)
        `)
        .eq('id', submissionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && open,
  });

  // Fetch scoring template for this event
  const { data: template } = useQuery({
    queryKey: ['event-scoring-template', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select(`
          *,
          categories:scoring_categories(*)
        `)
        .eq('event_id', eventId)
        .eq('is_default', true)
        .maybeSingle();
      
      // If no default, get first template
      if (!data) {
        const { data: firstTemplate, error: firstError } = await supabase
          .from('scoring_templates')
          .select(`
            *,
            categories:scoring_categories(*)
          `)
          .eq('event_id', eventId)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (firstError) throw firstError;
        return firstTemplate;
      }
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open,
  });

  // Fetch all scores for this submission
  const { data: allScores } = useQuery({
    queryKey: ['submission-all-scores', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          details:score_details(*),
          judge:profiles!scores_judge_user_id_fkey(full_name, email)
        `)
        .eq('submission_id', submissionId!);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && open,
  });

  // Fetch judge assignments for this event with profiles
  const { data: judgeAssignments } = useQuery({
    queryKey: ['event-judge-assignments', eventId],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('judge_assignments')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      
      // Fetch profiles separately
      const judgeIds = [...new Set(assignments.map(a => a.judge_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', judgeIds);
      
      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { user_id: string; full_name: string | null; email: string }>);
      
      return assignments.map(a => ({
        ...a,
        judge: profileMap[a.judge_user_id] || null,
      }));
    },
    enabled: !!eventId && open,
  });

  // Get score for selected panel
  const currentPanelScore = allScores?.find(s => s.panel_id === selectedPanelId);
  
  // Get judge assigned to selected panel
  const assignedJudge = judgeAssignments?.find(ja => ja.panel_id === selectedPanelId);

  // Initialize/reset scores when panel changes
  useEffect(() => {
    if (!template?.categories) return;
    
    const panelScore = allScores?.find(s => s.panel_id === selectedPanelId);
    
    if (panelScore?.details) {
      const loadedScores: Record<string, CategoryScore> = {};
      panelScore.details.forEach((detail: any) => {
        loadedScores[detail.category_id] = {
          category_id: detail.category_id,
          points: detail.points,
          notes: detail.notes || '',
        };
      });
      setCategoryScores(loadedScores);
      setDeductions(panelScore.deductions || 0);
      setComments(panelScore.comments || '');
    } else {
      // Initialize empty scores
      const initialScores: Record<string, CategoryScore> = {};
      template.categories.forEach((cat: any) => {
        initialScores[cat.id] = {
          category_id: cat.id,
          points: 0,
          notes: '',
        };
      });
      setCategoryScores(initialScores);
      setDeductions(0);
      setComments('');
    }
  }, [selectedPanelId, allScores, template]);

  const updateCategoryScore = (categoryId: string, points: number) => {
    setCategoryScores(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], points },
    }));
  };

  const updateCategoryNotes = (categoryId: string, notes: string) => {
    setCategoryScores(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], notes },
    }));
  };

  const calculateTotalScore = () => {
    if (!template?.categories) return 0;
    let total = 0;
    template.categories.forEach((cat: any) => {
      const score = categoryScores[cat.id]?.points || 0;
      total += score * (cat.weight || 1);
    });
    return Math.max(0, total - deductions);
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Save score mutation
  const saveMutation = useMutation({
    mutationFn: async (status: 'in_progress' | 'submitted') => {
      if (!selectedPanelId || !template || !assignedJudge) {
        throw new Error('Missing required data');
      }

      setIsSaving(true);
      const totalScore = calculateTotalScore();

      if (currentPanelScore) {
        // Update existing score
        const { error: scoreError } = await supabase
          .from('scores')
          .update({
            total_score: totalScore,
            deductions,
            comments,
            status,
            submitted_at: status === 'submitted' ? new Date().toISOString() : null,
          })
          .eq('id', currentPanelScore.id);
        if (scoreError) throw scoreError;

        // Delete existing details and insert new ones
        await supabase
          .from('score_details')
          .delete()
          .eq('score_id', currentPanelScore.id);

        const details = Object.values(categoryScores).map(catScore => ({
          score_id: currentPanelScore.id,
          category_id: catScore.category_id,
          points: catScore.points,
          notes: catScore.notes || null,
        }));
        
        const { error: detailError } = await supabase
          .from('score_details')
          .insert(details);
        if (detailError) throw detailError;
      } else {
        // Create new score
        const { data: newScore, error: scoreError } = await supabase
          .from('scores')
          .insert([{
            submission_id: submissionId,
            judge_user_id: assignedJudge.judge_user_id,
            template_id: template.id,
            panel_id: selectedPanelId,
            total_score: totalScore,
            deductions,
            comments,
            status,
            submitted_at: status === 'submitted' ? new Date().toISOString() : null,
          }])
          .select()
          .single();
        if (scoreError) throw scoreError;

        // Insert score details
        const details = Object.values(categoryScores).map(catScore => ({
          score_id: newScore.id,
          category_id: catScore.category_id,
          points: catScore.points,
          notes: catScore.notes || null,
        }));
        
        const { error: detailError } = await supabase
          .from('score_details')
          .insert(details);
        if (detailError) throw detailError;
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ 
        title: status === 'submitted' ? 'Score submitted!' : 'Progress saved',
      });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  const getPanelStatus = (panelId: string): 'pending' | 'in_progress' | 'submitted' => {
    const score = allScores?.find(s => s.panel_id === panelId);
    if (!score) return 'pending';
    return score.status as 'pending' | 'in_progress' | 'submitted';
  };

  const isCurrentPanelLocked = currentPanelScore?.status === 'locked';

  if (!submissionId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-4">
            <span>Score Submission</span>
            {submission && (
              <Badge variant="outline" className="font-normal">
                {submission.team?.name} • {submission.team?.gym_name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {submissionLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column - Video Player */}
              <div className="space-y-4">
                {/* Video Player Card */}
                <Card>
                  <CardContent className="p-0">
                    <div className="aspect-video bg-black rounded-t-lg relative">
                      {submission?.video_url ? (
                        <video
                          ref={videoRef}
                          src={submission.video_url}
                          className="w-full h-full rounded-t-lg"
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                          <div className="text-center">
                            <Play className="w-16 h-16 mx-auto mb-2" />
                            <p>Video not available</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Video Controls */}
                    <div className="p-4 space-y-3">
                      {/* Progress Bar */}
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                      />
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => skipTime(-10)}>
                            <SkipBack className="w-4 h-4" />
                          </Button>
                          <Button variant="default" size="icon" onClick={togglePlay}>
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => skipTime(10)}>
                            <SkipForward className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={toggleMute}>
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </Button>
                        </div>
                        
                        <span className="text-sm text-muted-foreground font-mono">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => videoRef.current?.requestFullscreen()}
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Team Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Team Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Event</span>
                      <p className="font-medium">{submission?.event?.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Division</span>
                      <p className="font-medium">{submission?.team?.division?.name || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Level</span>
                      <p className="font-medium">
                        {submission?.team?.level?.name || `Level ${submission?.team?.level?.level_number}` || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Athletes</span>
                      <p className="font-medium">{submission?.team?.athlete_count || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Panel Status Overview */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Panel Scoring Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {panels.map((panel) => {
                        const status = getPanelStatus(panel.id);
                        const statusColors = {
                          pending: 'bg-destructive text-destructive-foreground',
                          in_progress: 'bg-warning text-warning-foreground',
                          submitted: 'bg-success text-success-foreground',
                        };
                        const score = allScores?.find(s => s.panel_id === panel.id);
                        
                        return (
                          <div 
                            key={panel.id}
                            className={`px-3 py-2 rounded-lg text-center cursor-pointer transition-all ${
                              selectedPanelId === panel.id 
                                ? 'ring-2 ring-primary ring-offset-2' 
                                : ''
                            } ${statusColors[status]}`}
                            onClick={() => setSelectedPanelId(panel.id)}
                          >
                            <p className="font-bold">{panel.abbreviation}</p>
                            {score?.total_score !== null && score?.total_score !== undefined && (
                              <p className="text-xs opacity-90">{score.total_score.toFixed(1)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Scoring Form */}
              <div className="space-y-4">
                {/* Panel Selector */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium mb-1 block">Scoring Panel</label>
                        <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select panel" />
                          </SelectTrigger>
                          <SelectContent>
                            {panels.map((panel) => (
                              <SelectItem key={panel.id} value={panel.id}>
                                {panel.name} ({panel.abbreviation})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {assignedJudge && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Assigned Judge</p>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {assignedJudge.judge?.full_name || assignedJudge.judge?.email || 'Unassigned'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {!template ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scoring template configured for this event.</p>
                      <p className="text-sm mt-1">Create a scoring template first.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Category Scores */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {template.categories
                        ?.sort((a: any, b: any) => a.display_order - b.display_order)
                        .map((category: any) => (
                        <Card key={category.id} className="overflow-hidden">
                          <CardHeader className="py-3 pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{category.name}</CardTitle>
                              <div className="text-right">
                                <span className="text-xl font-bold text-primary">
                                  {categoryScores[category.id]?.points || 0}
                                </span>
                                <span className="text-xs text-muted-foreground"> / {category.max_points}</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="py-2 space-y-2">
                            <Slider
                              value={[categoryScores[category.id]?.points || 0]}
                              min={0}
                              max={category.max_points}
                              step={0.5}
                              onValueChange={([value]) => updateCategoryScore(category.id, value)}
                              disabled={isCurrentPanelLocked}
                            />
                            <Input
                              placeholder="Notes..."
                              value={categoryScores[category.id]?.notes || ''}
                              onChange={(e) => updateCategoryNotes(category.id, e.target.value)}
                              disabled={isCurrentPanelLocked}
                              className="text-sm h-8"
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Separator />

                    {/* Deductions */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-destructive">Deductions</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={deductions}
                            onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
                            className="w-24"
                            disabled={isCurrentPanelLocked}
                          />
                          <span className="text-sm text-muted-foreground">points</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Score</p>
                        <p className="text-3xl font-bold text-primary">
                          {calculateTotalScore().toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="text-sm font-medium">Feedback & Comments</label>
                      <Textarea
                        placeholder="Overall feedback for the team..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={3}
                        disabled={isCurrentPanelLocked}
                        className="mt-1"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {isCurrentPanelLocked ? (
                        <Badge variant="secondary" className="py-2 px-4">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Score Locked
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => saveMutation.mutate('in_progress')}
                            disabled={isSaving || !assignedJudge}
                            className="flex-1"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Draft
                          </Button>
                          <Button
                            onClick={() => saveMutation.mutate('submitted')}
                            disabled={isSaving || !assignedJudge}
                            className="flex-1"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Submit Score
                          </Button>
                        </>
                      )}
                    </div>
                    
                    {!assignedJudge && (
                      <p className="text-xs text-destructive text-center">
                        No judge assigned to this panel. Assign a judge first.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
