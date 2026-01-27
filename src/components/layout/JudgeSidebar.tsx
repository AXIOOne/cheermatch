import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  ClipboardList,
  LogOut,
  LayoutDashboard,
  Play,
  History,
} from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function JudgeSidebar() {
  const { signOut, user } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-sidebar-background flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">CheerMatch</h1>
            <p className="text-xs text-sidebar-foreground/50">Judge Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/judge" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
        <NavItem to="/judge/queue" icon={<Play className="w-5 h-5" />} label="Scoring Queue" />
        <NavItem to="/judge/history" icon={<History className="w-5 h-5" />} label="Score History" />
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email || 'Judge'}
            </p>
            <p className="text-xs text-sidebar-foreground/50">Judge</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
