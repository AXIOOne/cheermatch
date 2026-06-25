import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import logoWhite from '@/assets/logo-white.png.asset.json';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RubricsNavItem } from '@/components/layout/RubricsNavItem';
import {
  Calendar,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  LayoutDashboard,
  Layers,
  UserCheck,
  MessageSquareText,
  ShieldCheck,
  Video,
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

export function AdminSidebar() {
  const { signOut, user } = useAuth();
  const { branding } = usePlatformSettings();
  const logoSrc = branding?.logoUrl || logoWhite.url;

  const { data: profile } = useQuery({
    queryKey: ['sidebar-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <aside className="w-64 min-h-screen bg-black flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Portal" className="h-8 max-w-full object-contain" />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
        <NavItem to="/admin/events" icon={<Calendar className="w-5 h-5" />} label="Events" />
        <NavItem to="/admin/scoring" icon={<ClipboardList className="w-5 h-5" />} label="Scoring Templates" />
        <RubricsNavItem to="/admin/rubrics" />
        <NavItem to="/admin/divisions" icon={<Layers className="w-5 h-5" />} label="Divisions & Levels" />
        
        <NavItem to="/admin/submissions" icon={<Video className="w-5 h-5" />} label="Submissions" />
        
        <NavItem to="/admin/reviews" icon={<MessageSquareText className="w-5 h-5" />} label="AccuScore" />
        <NavItem to="/admin/roles" icon={<ShieldCheck className="w-5 h-5" />} label="User Roles" />
        <NavItem to="/admin/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-9 w-9">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || user?.email || ''} />}
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
              {(profile?.full_name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email || 'Admin'}
            </p>
            <p className="text-xs text-sidebar-foreground/50">Administrator</p>
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
