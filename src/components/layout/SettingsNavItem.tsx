import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Settings,
  ChevronDown,
  ShieldCheck,
  ClipboardList,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

const CHILDREN = [
  { to: '/admin/settings', label: 'General', icon: SlidersHorizontal },
  { to: '/admin/scoring', label: 'Scoring Templates', icon: ClipboardList },
  { to: '/admin/divisions', label: 'Divisions & Levels', icon: Layers },
  { to: '/admin/roles', label: 'User Roles', icon: ShieldCheck },
];

export function SettingsNavItem() {
  const { pathname } = useLocation();
  const isActive = CHILDREN.some((c) => pathname.startsWith(c.to));
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
        <Settings className="w-5 h-5" />
        <span className="flex-1 text-left">Settings</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border space-y-1">
          {CHILDREN.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.to === '/admin/settings'}
              className={({ isActive: active }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )
              }
            >
              <c.icon className="w-4 h-4" />
              <span className="flex-1">{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
