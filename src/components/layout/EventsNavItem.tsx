import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  MessageSquareText,
} from 'lucide-react';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@/components/ui/sidebar';

const CHILDREN = [
  { to: '/admin/events', label: 'Events', icon: Calendar, end: true },
  { to: '/admin/reviews', label: 'AccuScore', icon: MessageSquareText },
];

export function EventsNavItem() {
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
          tooltip="Events"
          isActive={isActive}
          onClick={() => navigate('/admin/events')}
        >
          <Calendar className="w-5 h-5" />
          <span>Events</span>
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
        <Calendar className="w-5 h-5" />
        <span className="flex-1 text-left">Events</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {CHILDREN.map((c) => (
            <SidebarMenuItem key={c.to}>
              <NavLink
                to={c.to}
                end={c.end}
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
