import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@/components/ui/sidebar';

interface Discipline {
  label: string;
  href: string;
  external?: boolean;
}

const DISCIPLINES: Discipline[] = [
  {
    label: 'All-Star Cheer',
    href: 'https://www.unitedscoringpartners.com',
    external: true,
  },
];

interface Props {
  /** In-app route for the Rubrics page (used for active-state highlight). */
  to: string;
}

export function RubricsNavItem({ to }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.startsWith(to);
  const [open, setOpen] = useState(isActive);
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Scoring Rubrics"
          isActive={isActive}
          onClick={() => navigate(to)}
        >
          <FileText className="w-5 h-5" />
          <span>Scoring Rubrics</span>
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
        <FileText className="w-5 h-5" />
        <span className="flex-1 text-left">Scoring Rubrics</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {DISCIPLINES.map((d) => {
            const className =
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors';
            if (d.external) {
              return (
                <a
                  key={d.label}
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  <span className="flex-1">{d.label}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              );
            }
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => navigate(d.href)}
                className={cn(className, 'w-full text-left')}
              >
                {d.label}
              </button>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
