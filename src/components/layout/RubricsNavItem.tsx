import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, ChevronDown, ExternalLink } from 'lucide-react';

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

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )}
        aria-expanded={open}
      >
        <FileText className="w-5 h-5" />
        <span className="flex-1 text-left">Rubrics</span>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border space-y-1">
          {DISCIPLINES.map((d) => {
            const className =
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors';
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
        </div>
      )}
    </div>
  );
}
