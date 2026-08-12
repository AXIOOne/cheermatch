import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  Layers,
  SlidersHorizontal,
  Building2,
} from 'lucide-react';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@/components/ui/sidebar';

const CHILDREN = [
  { to: '/admin/settings', label: 'General', icon: SlidersHorizontal },
  { to: '/admin/scoring', label: 'Scoring Templates', icon: ClipboardList },
  { to: '/admin/divisions', label: 'Divisions & Levels', icon: Layers },
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/roles', label: 'User Roles', icon: ShieldCheck },
];

export function SettingsNavItem() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = CHILDREN.some((c) => pathname.startsWith(c.to));
  const [open, setOpen] = useState(isActive);
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Settings"
          isActive={isActive}
          onClick={() => navigate('/admin/settings')}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setOpen((o) => !o)}
        isActive={isActive}
      >
        <Settings className="w-5 h-5" />
        <span className="flex-1 text-left">Settings</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {CHILDREN.map((c) => (
            <SidebarMenuItem key={c.to}>
              <NavLink
                to={c.to}
                end={c.to === '/admin/settings'}
                className={({ isActive: active }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )
                }
              >
                <c.icon className="w-4 h-4" />
                <span className="flex-1">{c.label}</span>
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
