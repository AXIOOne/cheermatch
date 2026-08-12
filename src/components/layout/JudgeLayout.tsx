import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { JudgeSidebar } from './JudgeSidebar';
import { JudgeBroadcastBanner } from '@/components/judge/JudgeBroadcastBanner';
import { JudgeMessagesMenu } from '@/components/judge/JudgeMessagesMenu';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export function JudgeLayout() {
  const { user, loading, rolesLoaded, isJudge, isAdmin } = useAuth();

  if (loading || (user && !rolesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow access if user is judge or admin
  if (!isJudge && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the judge portal.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <JudgeSidebar />
        <SidebarInset>
          <JudgeBroadcastBanner />
          <header className="flex h-12 items-center justify-end gap-2 px-4 border-b">
            <SidebarTrigger className="mr-auto -ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-muted-foreground">Judge Portal</span>
            <JudgeMessagesMenu />
          </header>
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
