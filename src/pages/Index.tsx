import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, rolesLoaded, isAdmin, isJudge, isGymCoach } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || !rolesLoaded) return;
    if (isAdmin) navigate('/admin', { replace: true });
    else if (isJudge) navigate('/judge', { replace: true });
    else if (isGymCoach) navigate('/m', { replace: true });
    else navigate('/admin', { replace: true });
  }, [user, loading, rolesLoaded, isAdmin, isJudge, isGymCoach, navigate]);

  if (loading || (user && !rolesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
