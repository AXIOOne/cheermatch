import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { HelpTopic } from '@/content/help';

const calloutStyles = {
  note: { icon: Info, cls: 'border-primary/40 bg-primary/5' },
  warning: { icon: AlertTriangle, cls: 'border-destructive/40 bg-destructive/5' },
  tip: { icon: Lightbulb, cls: 'border-muted-foreground/30 bg-muted/50' },
} as const;

export function HelpArticle({ topic }: { topic: HelpTopic }) {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold text-foreground">{topic.title}</h1>
      <p className="mt-2 text-muted-foreground">{topic.summary}</p>

      <div className="mt-8 space-y-6">
        {topic.blocks.map((block, i) => {
          switch (block.type) {
            case 'heading':
              return (
                <h2 key={i} className="text-xl font-semibold text-foreground pt-2">
                  {block.text}
                </h2>
              );
            case 'p':
              return (
                <p key={i} className="text-sm leading-relaxed text-foreground/90">
                  {block.text}
                </p>
              );
            case 'bullets':
              return (
                <ul key={i} className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
                  {block.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              );
            case 'steps':
              return (
                <ol key={i} className="list-decimal pl-5 space-y-2 text-sm text-foreground/90">
                  {block.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ol>
              );
            case 'table':
              return (
                <div key={i} className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {block.head.map((h, j) => (
                          <TableHead key={j}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {block.rows.map((row, j) => (
                        <TableRow key={j}>
                          {row.map((cell, k) => (
                            <TableCell key={k} className="align-top text-sm">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            case 'callout': {
              const { icon: Icon, cls } = calloutStyles[block.variant];
              return (
                <div key={i} className={cn('flex gap-3 rounded-md border p-4', cls)}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="text-sm text-foreground/90">
                    {block.title && <p className="font-semibold mb-1">{block.title}</p>}
                    <p>{block.text}</p>
                  </div>
                </div>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}
