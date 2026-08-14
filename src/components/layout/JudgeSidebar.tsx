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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

import {
  LogOut,
  LayoutDashboard,
  Play,
  ClipboardList,
} from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <NavLink
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )
          }
        >
          {icon}
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function JudgeSidebar() {
  const { signOut, user } = useAuth();
  const { branding } = usePlatformSettings();
  const logoSrc = branding?.logoUrl || logoWhite.url;
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

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
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarRail />

      <SidebarHeader>
        <div className={cn('flex items-center', collapsed ? 'justify-center p-2' : 'gap-3 px-2 py-3')}>
          <img
            src={logoSrc}
            alt="Portal"
            className={cn('object-contain', collapsed ? 'h-7 w-7' : 'h-8 max-w-full')}
          />
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              v2.0
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/judge" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
              <NavItem to="/judge/queue" icon={<Play className="w-5 h-5" />} label="Scoring Queue" />
              <RubricsNavItem to="/judge/rubrics" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className={cn('flex items-center gap-3', collapsed ? 'justify-center p-2' : 'px-2 py-2')}>
          <Avatar className="h-9 w-9 shrink-0">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || user?.email || ''} />}
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
              {(profile?.full_name?.[0] || user?.email?.[0] || 'J').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email || 'Judge'}
              </p>
              <p className="text-xs text-sidebar-foreground/50">Judge</p>
            </div>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Log Out">
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
