import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Trophy, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';

interface ScoreField {
  name: string;
  points: number;
  max_points: number;
  section_name?: string;
}

interface Score {
  score_id: string;
  total_score: number;
  deductions: number;
  comments: string | null;
  submitted_at: string;
  fields: ScoreField[] | null;
}

interface ReviewData {
  token_id: string;
  token_status: string;
  coach_email: string;
  coach_name: string | null;
  expires_at: string;
  team_name: string;
  gym_name: string;
  division_name: string;
  level_name: string;
  event_name: string;
  video_url: string | null;
  thumbnail_url: string | null;
  submission_status: string;
  scores: Score[] | null;
}

export default function ScoreReview() {
  const { token } = useParams<{ token: string }>();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchReview() {
      if (!token) {
        setError('Invalid review link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_review_by_token', { review_token: token });

        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          setError('This review link is invalid or has expired');
          setLoading(false);
          return;
        }

        setReviewData(data[0] as unknown as ReviewData);

        // Mark as viewed
        await supabase.rpc('mark_review_viewed', { review_token: token });
      } catch (err: any) {
        setError(err.message || 'Failed to load review data');
      } finally {
        setLoading(false);
      }
    }

    fetchReview();
  }, [token]);

  const handleSubmitReview = async () => {
    if (!token || !reviewNotes.trim()) {
      toast({
        variant: 'destructive',
        title: 'Please provide details',
        description: 'Explain what you would like reviewed about this score.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .rpc('submit_review_request', { 
          review_token: token, 
          notes: reviewNotes 
        });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: 'Review request submitted',
        description: 'An administrator will review your request.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to submit review request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-bold mb-2">Unable to Load Review</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reviewData) return null;

  const hasRequestedReview = reviewData.token_status === 'review_requested' || submitted;
  const isResolved = reviewData.token_status === 'resolved';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logoBlack} alt="CheerMatch" className="h-8" />
          <span className="text-sm text-muted-foreground">Score Review Portal</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Team Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{reviewData.team_name}</h1>
          <p className="text-lg text-muted-foreground">{reviewData.gym_name}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
              {reviewData.event_name}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
              {reviewData.division_name}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-muted text-muted-foreground">
              {reviewData.level_name}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Video Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Performance Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewData.video_url ? (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={reviewData.video_url}
                      controls
                      className="w-full h-full"
                      poster={reviewData.thumbnail_url || undefined}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Scores Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewData.scores && reviewData.scores.length > 0 ? (
                  <div className="space-y-6">
                    {reviewData.scores.map((score, idx) => (
                      <div key={score.score_id} className="space-y-4">
                        {reviewData.scores!.length > 1 && (
                          <p className="text-sm font-medium text-muted-foreground">
                            Judge {idx + 1}
                          </p>
                        )}
                        
                        {/* % Perfection Score */}
                        <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                          <span className="font-medium">% Perfection Score</span>
                          <span className="text-2xl font-bold text-primary">
                            {score.total_score != null ? `${score.total_score.toFixed(2)}%` : 'N/A'}
                          </span>
                        </div>

                        {/* Deductions */}
                        {score.deductions && score.deductions > 0 && (
                          <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                            <span className="text-sm font-medium">Deductions</span>
                            <span className="font-bold text-destructive">
                              -{score.deductions}
                            </span>
                          </div>
                        )}

                        {/* Field Breakdown */}
                        {score.fields && score.fields.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Score Breakdown
                            </p>
                            {score.fields.map((f, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-2 border-b last:border-0"
                              >
                                <span className="text-sm">
                                  {f.section_name ? <span className="text-muted-foreground mr-1">{f.section_name} —</span> : null}
                                  {f.name}
                                </span>
                                <span className="text-sm font-medium">
                                  {f.points} / {f.max_points}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comments */}
                        {score.comments && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Judge Comments</p>
                            <p className="text-sm text-muted-foreground">{score.comments}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Scores have not been submitted yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Review Request Section */}
            <Card>
              <CardHeader>
                <CardTitle>Request Score Review</CardTitle>
              </CardHeader>
              <CardContent>
                {isResolved ? (
                  <div className="text-center py-4">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">Review Completed</p>
                    <p className="text-sm text-muted-foreground">
                      This review request has been resolved.
                    </p>
                  </div>
                ) : hasRequestedReview ? (
                  <div className="text-center py-4">
                    <Clock className="w-10 h-10 mx-auto mb-3 text-primary" />
                    <p className="font-medium">Review Request Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      An administrator will review your request and contact you.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      If you believe there is an error in the scoring, you may request a review. 
                      Please provide details about what you would like reviewed.
                    </p>
                    <Textarea
                      placeholder="Explain what you would like reviewed..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={4}
                    />
                    <Button 
                      onClick={handleSubmitReview} 
                      disabled={submitting || !reviewNotes.trim()}
                      className="w-full"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Submit Review Request
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>This link expires on {new Date(reviewData.expires_at).toLocaleDateString()}</p>
        </footer>
      </main>
    </div>
  );
}
