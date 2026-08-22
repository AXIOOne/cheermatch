import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findTopic, searchTopics } from '@/content/help';
import { HelpArticle } from './HelpArticle';

interface Props {
  audience: 'admin' | 'judge';
  basePath: string;
  showManualDownload?: boolean;
}

export function HelpLayout({ audience, basePath, showManualDownload }: Props) {
  const { topic: slug } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchTopics(audience, query), [audience, query]);
  const active = findTopic(audience, slug);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="w-7 h-7 text-primary" />
            Help & Documentation
          </h1>
          <p className="text-muted-foreground mt-1">
            Reference guides for every feature of the portal.
          </p>
        </div>
        {showManualDownload && (
          <Button variant="outline" asChild>
            <a href="/docs/cheermatch-admin-manual.pdf" download>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF manual
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <nav className="space-y-1">
            {results.map((t) => (
              <button
                key={t.slug}
                onClick={() => navigate(`${basePath}/${t.slug}`)}
                className={cn(
                  'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                  t.slug === active?.slug
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {t.title}
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No topics match your search.</p>
            )}
          </nav>
        </div>

        <Card>
          <CardContent className="p-6">
            {active ? <HelpArticle topic={active} /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
