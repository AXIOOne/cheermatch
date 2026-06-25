import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';

interface Props {
  eventId?: string | null;
  divisionId?: string | null;
  levelId?: string | null;
}

const DISCIPLINES: { label: string; href: string; external?: boolean }[] = [
  {
    label: 'All-Star Cheer',
    href: 'https://www.unitedscoringpartners.com',
    external: true,
  },
];

export function RubricReferenceSheet(_props: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <BookOpen className="w-4 h-4 mr-2" />
          Rubrics
          <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {DISCIPLINES.map((d) => (
          <DropdownMenuItem
            key={d.label}
            onSelect={() => {
              if (d.external) {
                window.open(d.href, '_blank', 'noopener,noreferrer');
              } else {
                window.location.href = d.href;
              }
            }}
          >
            <span className="flex-1">{d.label}</span>
            {d.external && <ExternalLink className="w-3.5 h-3.5 opacity-60" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
