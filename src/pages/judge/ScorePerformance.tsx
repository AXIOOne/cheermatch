import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Send, Loader2, Play, Pause, RotateCcw } from 'lucide-react';

interface CategoryScore {
  category_id: string;
  points: number;
  notes: string;
}

export default function ScorePerformance() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [categoryScores, setCategoryScores] = useState<Record<string, CategoryScore>>({});
  const [deductions, setDeductions] = useState(0);
  const [comments, setComments] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch submission with team details
  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission', submissionId],
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
    enabled: !!submissionId,
  });

  // Fetch scoring template for this event
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['scoring-template', submission?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select(`
          *,
          categories:scoring_categories(*)
        `)
        .eq('event_id', submission!.event_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submission?.event_id,
  });

  // Fetch existing score if any
  const { data: existingScore } = useQuery({
    queryKey: ['existing-score', submissionId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          details:score_details(*)
        `)
        .eq('submission_id', submissionId!)
        .eq('judge_user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && !!user,
  });

  // Initialize scores from existing data or defaults
  useEffect(() => {
    if (template?.categories && !existingScore) {
      const initialScores: Record<string, CategoryScore> = {};
      template.categories.forEach((cat: any) => {
        initialScores[cat.id] = {
          category_id: cat.id,
          points: 0,
          notes: '',
        };
      });
      setCategoryScores(initialScores);
    } else if (existingScore) {
      const loadedScores: Record<string, CategoryScore> = {};
      existingScore.details?.forEach((detail: any) => {
        loadedScores[detail.category_id] = {
          category_id: detail.category_id,
          points: detail.points,
          notes: detail.notes || '',
        };
      });
      setCategoryScores(loadedScores);
      setDeductions(existingScore.deductions || 0);
      setComments(existingScore.comments || '');
    }
  }, [template, existingScore]);

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

  // Save score mutation
  const saveMutation = useMutation({
    mutationFn: async (status: 'in_progress' | 'submitted') => {
      setIsSaving(true);
      const totalScore = calculateTotalScore();

      if (existingScore) {
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
          .eq('id', existingScore.id);
        if (scoreError) throw scoreError;

        // Upsert score details
        for (const catScore of Object.values(categoryScores)) {
          const { error: detailError } = await supabase
            .from('score_details')
            .upsert({
              score_id: existingScore.id,
              category_id: catScore.category_id,
              points: catScore.points,
              notes: catScore.notes || null,
            }, { onConflict: 'score_id,category_id' });
          if (detailError) throw detailError;
        }
      } else {
        // Create new score
        const { data: newScore, error: scoreError } = await supabase
          .from('scores')
          .insert([{
            submission_id: submissionId,
            judge_user_id: user!.id,
            template_id: template!.id,
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
      queryClient.invalidateQueries({ queryKey: ['existing-score'] });
      queryClient.invalidateQueries({ queryKey: ['judge-scores'] });
      queryClient.invalidateQueries({ queryKey: ['judge-existing-scores'] });
      
      if (status === 'submitted') {
        toast({ title: 'Score submitted successfully!' });
        navigate('/judge/queue');
      } else {
        toast({ title: 'Progress saved' });
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  const isLoading = submissionLoading || templateLoading;
  const isLocked = existingScore?.status === 'locked';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Submission not found</h1>
        <Button className="mt-4" onClick={() => navigate('/judge/queue')}>
          Back to Queue
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/judge/queue')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">{submission.team?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {submission.team?.gym_name} • {submission.team?.division?.name} • Level {submission.team?.level?.level_number}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLocked && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => saveMutation.mutate('in_progress')}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Draft
                </Button>
                <Button 
                  onClick={() => saveMutation.mutate('submitted')}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Score
                </Button>
              </>
            )}
            {isLocked && (
              <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">
                Score Locked
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Video Player */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black rounded-t-lg flex items-center justify-center">
                  {submission.video_url ? (
                    <video 
                      src={submission.video_url} 
                      controls 
                      className="w-full h-full rounded-t-lg"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  ) : (
                    <div className="text-white/50 text-center">
                      <Play className="w-16 h-16 mx-auto mb-2" />
                      <p>Video not available</p>
                      <p className="text-sm mt-1">Demo mode - no video uploaded</p>
                    </div>
                  )}
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {submission.duration_seconds 
                      ? `${Math.floor(submission.duration_seconds / 60)}:${(submission.duration_seconds % 60).toString().padStart(2, '0')}`
                      : 'Duration unknown'
                    }
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Replay
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Event</span>
                  <p className="font-medium">{submission.event?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Division</span>
                  <p className="font-medium">{submission.team?.division?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Level</span>
                  <p className="font-medium">Level {submission.team?.level?.level_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Athletes</span>
                  <p className="font-medium">{submission.team?.athlete_count}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scoring Form */}
          <div className="space-y-4">
            {template?.categories && template.categories.length > 0 ? (
              <>
                {/* Category Scores */}
                {template.categories
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any) => (
                  <Card key={category.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary">
                            {categoryScores[category.id]?.points || 0}
                          </span>
                          <span className="text-sm text-muted-foreground"> / {category.max_points}</span>
                        </div>
                      </div>
                      {category.description && (
                        <CardDescription>{category.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Slider
                        value={[categoryScores[category.id]?.points || 0]}
                        min={0}
                        max={category.max_points}
                        step={0.5}
                        onValueChange={([value]) => updateCategoryScore(category.id, value)}
                        disabled={isLocked}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0</span>
                        <span>{category.max_points}</span>
                      </div>
                      <Input
                        placeholder="Notes for this category..."
                        value={categoryScores[category.id]?.notes || ''}
                        onChange={(e) => updateCategoryNotes(category.id, e.target.value)}
                        disabled={isLocked}
                      />
                    </CardContent>
                  </Card>
                ))}

                <Separator />

                {/* Deductions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-destructive">Deductions</CardTitle>
                    <CardDescription>Safety violations, legality issues, etc.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={deductions}
                        onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
                        className="w-24"
                        disabled={isLocked}
                      />
                      <span className="text-sm text-muted-foreground">points</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Comments */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Feedback & Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Overall feedback for the team..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={4}
                      disabled={isLocked}
                    />
                  </CardContent>
                </Card>

                {/* Total Score */}
                <Card className="gradient-champion text-white">
                  <CardContent className="py-6 text-center">
                    <p className="text-sm opacity-80 mb-1">Total Score</p>
                    <p className="text-5xl font-bold">{calculateTotalScore().toFixed(2)}</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No scoring template configured for this event.</p>
                  <p className="text-sm mt-1">Contact an administrator to set up the scoring rubric.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
