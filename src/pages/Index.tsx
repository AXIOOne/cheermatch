import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, ClipboardCheck, Video, Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, isAdmin, isJudge, isGymCoach, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Redirect based on role
      if (isAdmin || roles.length === 0) {
        // New users or admins go to admin dashboard
        navigate('/admin');
      } else if (isJudge) {
        navigate('/judge');
      } else if (isGymCoach) {
        navigate('/coach');
      }
    }
  }, [user, loading, isAdmin, isJudge, isGymCoach, roles, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="gradient-champion text-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center shadow-xl">
              <Trophy className="w-9 h-9 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">CheerMatch</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            The complete virtual cheerleading competition platform. Manage events, score performances, and celebrate champions.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="gradient-gold text-primary font-semibold" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Built for Champions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Event Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create and manage competitions with custom divisions, levels, and scoring rubrics.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                <ClipboardCheck className="w-7 h-7 text-secondary" />
              </div>
              <CardTitle>Custom Scoring</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Build detailed scoring templates with weighted categories for fair, consistent judging.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Video className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Video Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Upload and stream performance videos with Brightcove's powerful video platform.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-7 h-7 text-secondary" />
              </div>
              <CardTitle>Team Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Easy registration and video submission for gyms and coaches.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 CheerMatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
